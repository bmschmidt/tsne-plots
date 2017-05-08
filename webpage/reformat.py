import json
import random
import math
import os
from argparse import ArgumentParser
import logging
import shutil
import logging
import icu


def get_bounds(filename):
    xlim = [float("inf"),float("-inf")]
    ylim = [float("inf"),float("-inf")]    
    fin = open(filename,"r")
    # The first line is column names
    _ = fin.readline()
    for line in fin:
        x,y = map(float,line.split())
        if x < xlim[0]: xlim[0] = x
        if y < ylim[0]: ylim[0] = y
        if x > xlim[1]: xlim[1] = x
        if y > ylim[1]: ylim[1] = y

    xrange = (xlim[1] - xlim[0]) *.05
    yrange = (ylim[1] - ylim[0]) *.05

    
    return ([xlim[0]-xrange,xlim[1] + xrange],[ylim[0]-yrange,ylim[1]+yrange])

def rescale(value,lims,modulo):
    # Gives the cell for a value
    # out in a grid of length modulo
    range = lims[1]-lims[0]
    this_val = value-lims[0]
    returnable = int(modulo*(this_val/float(range)))
    if returnable >= modulo:
        returnable = modulo-1
    if returnable < 0:
        returnable = 0
    return returnable

class Datatiler(object):
    
    def __init__(self,tile_width,max,xlim,ylim,headers = ["x","y","id"]):
        self.reset(tile_width=tile_width,max=max,xlim=xlim,ylim=ylim,headers=headers)
        if os.path.exists("tiles"):
            shutil.rmtree('tiles')

    def reset(self,tile_width,max,xlim,ylim,headers = ["x","y","id"]):
        """"
        Called in the initilization, and then again when every the tiles are made
        smaller.
        """
        self.tile_width = tile_width
        self.max = max
        self.xlim = xlim
        self.ylim = ylim
        self.headers = headers
                
        self.data = dict()
        self.counts = dict()
        self.files = dict()
        
    def return_file(self,x,y,clobber=True):
        if (x,y) in self.files:
            return self.files[(x,y)]
        dir = "/".join(map(str,["tiles",self.tile_width, x]))
        filename = "%s/%i.tsv"%(dir,y)
        if os.path.exists(filename):
            # When already created, append.
            self.files[(x,y)] = open(filename,"a")
            return self.files[(x,y)]
        if not os.path.exists(dir):
            os.makedirs(dir)
        self.files[(x,y)] = open(filename, "w")
        # Write the headers
        self.files[(x,y)].write("\t".join(self.headers) + "\n")
        return self.files[(x,y)]

    def flush(self):
        for (x,y) in self.data.keys():
            try:
                rows = self.data[(x,y)]
            except KeyError:
                continue
            try:
                file = self.return_file(x,y)
            except IOError as e:
                if "Errno 24" in str(e):
                    # If it's full, close all the files and try again.
                    self.close_files()
                    self.flush()
                    return
                else:
                    raise
            for row in rows:
                file.write("\t".join(row) + "\n")
            del self.data[(x,y)]
            
    def close_files(self):
        for key in self.files.keys():
            self.files[key].close()
            del self.files[key]

    def subdivide(self):
        self.flush()
        self.close_files()
        self.reset(self.tile_width*2,self.max,self.xlim,self.ylim,self.headers)
        
    def insert(self,point):
        """
        Point can be an object of any length, but the first elements must be "x" and "y" coordinates.
        This returns the current datatiler object; but if the insertion pushes the 
        object over the threshold,
        it returns a new finer grained one.
        """
        x = rescale(point[0],self.xlim,self.tile_width)
        y = rescale(point[1],self.ylim,self.tile_width)
        try:
            self.counts[(x,y)] += 1
            if self.counts[(x,y)] > self.max:
                # Partition up into twice as many tiles.
                self.subdivide()
            # Coerce to string before writing so we can have mixed types in the input.
            self.data[(x,y)].append(map(str,point))
        except KeyError:
            self.counts[(x,y)] = 1
            self.data[(x,y)] = [map(str,point)]
        return [self.tile_width,x,y, point[0], point[1]]

class Indexer(object):
    def __init__(self, argp, target_size = 1500, max_stack = 1e06):
        """
        argp: The system arguments

        target_size: the desired size of the index files to be sent over the web,
        in number of entries.

        max_stack: the maximum number of entries to keep on hand: higher values
        use more memory, but take less I/O.
        """
        ids = []
        f = open(argp.metadata)
        f.readline()
        for i,line in enumerate(f):
            id = line.split()[0]
            ids.append(id)
            
        f.close()
        #collator = icu.Collator.createInstance(icu.Locale('de_DE.UTF-8'))
        
        #ids.sort(key=collator.getSortKey)
        ids.sort()
        
        self.id_lookup = dict()
        self.index_description = [{"start":ids[0]}]
        for i,id in enumerate(ids):
            if (i % target_size) == (target_size-1):
                self.index_description[-1]["end"] = ids[i-1]
                self.index_description.append({"start":id})
            self.id_lookup[id] = len(self.index_description)-1
            
        # The last one ends at the end.
        self.index_description[-1]["end"] = ids[i]
        if not os.path.exists("index"):
            os.makedirs("index")
        


        # Setup the stack size.
        self.stack_size = 0
        self.stack = [[] for i in self.index_description]
        self.max_stack = max_stack
        
    def insert(self,l):

        self.stack_size +=1
        id = l[0]
        self.stack[self.id_lookup[id]].append(l)
        
        if self.stack_size > self.max_stack:
            self.flush(self.which_list_is_longest())

    def which_list_is_longest(self):
        biggest = -1
        for i,row in self.stack:
            if len(row) > biggest:
                biggest = i
        return biggest
        
    def flush(self,i):
        if len(self.stack[i])==0:
            return
        
        desc = self.index_description[i]
        indexname = "index/{}-{}".format(desc["start"],desc["end"])
        decrementer = 0

        
        if not os.path.exists(indexname):
            # Write column headers when opening the first time.
            f = open(indexname, "w")
            f.write("\t".join(["id","z","x","y","x_","y_"]) + "\n")
            
        else:
            f = open(indexname, "a")
            
        for row in self.stack[i]:
            decrementer += 1
            line = "\t".join(map(unicode,row)) + "\n"
            f.write(line.encode("utf-8"))
        self.stack_size = self.stack_size - decrementer
        f.close()
        
    def close(self):
        fout = open("index_desc.tsv","w")
        fout.write("\t".join(["start","end","file"]) + "\n")
        for i in range(len(self.stack)):
            self.flush(i)
            desc = self.index_description[i]
            indexname = "index/{}-{}".format(desc["start"],desc["end"])
            row = "\t".join([desc["start"],desc["end"],indexname]).encode("utf-8")
            fout.write(row + "\n")


        fout.close()
def parse_args():
    argparse = ArgumentParser('python data tiler')
    argparse.add_argument("-f","--file",help="Input filename of coordinates. Tab or space sedarated; first row must be column names. This file should not include identifiers of any sort.")
    argparse.add_argument("-m","--metadata",help="additional metadata (same order and length as file). Tab separated, first row gives names.")
    argparse.add_argument("-t","--tile-density", type=int, default = 1000, help="Maximum number of points per tile")
    argparse.add_argument("-k","--key-index", type=bool, default = True, help="Build an index to the identifiers as well.")
    return argparse.parse_args()

def main():
    argp = parse_args()
    if argp.key_index:
        indexer = Indexer(argp)
        
    logging.info("Scanning file to determine limits") 
    limits = get_bounds(argp.file)

    metadata = open(argp.metadata)
    metaheader = metadata.readline().rstrip("\n").split("\t")
    
    tiler = Datatiler(1,argp.tile_density,limits[0],limits[1],headers = ["x","y"] + metaheader)
    parsed_so_far = 0
    
    for i,line in enumerate(open(argp.file)):
        if i==0:
            continue
        point = map(float,line.split())
        metaline = metadata.readline().rstrip("\n").split("\t")
        row_data = tiler.insert(point + metaline)
        if argp.key_index:
            indexer.insert([metaline[0]] + row_data)
        parsed_so_far += 1
        
    tiler.flush()
    indexer.close()
    
    tiler.close_files()
    
    settings = open("data_description.json","w")
    settingdict = {
        "limits":limits,
        "max_zoom":tiler.tile_width
    }
    json.dump(settingdict,settings)
    
if __name__=="__main__":
    main()
