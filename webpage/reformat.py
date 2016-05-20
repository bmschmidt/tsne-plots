import json
import random
import math
import os
from argparse import ArgumentParser
import logging
import shutil

def get_bounds(filename):
    xlim = [float("inf"),float("-inf")]
    ylim = [float("inf"),float("-inf")]    
    fin = open(filename,"r")
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

        This returns the current datatiler object; but the insertion pushes the object over the threshold,
        it returns a new finer grained one.
        """
        x = rescale(point[0],self.xlim,self.tile_width)
        y = rescale(point[1],self.ylim,self.tile_width)
        try:
            self.counts[(x,y)] += 1
            if self.counts[(x,y)] > self.max:
                # Partition up into twice as many tiles.
                self.subdivide()
                # On a subdivide, the data won't exist so the exception is raised.
            # Coerce to string before writing so we can have mixed types in the input.
            self.data[(x,y)].append(map(str,point))
        except KeyError:
            self.counts[(x,y)] = 1
            self.data[(x,y)] = [map(str,point)]
        return True

def parse_args():
    argparse = ArgumentParser('python data tiler')
    argparse.add_argument("-f","--file",help="input filename")
    argparse.add_argument("-m","--metadata",help="additional metadata (same order and length as file)")      
    return argparse.parse_args()

def main():
    argp = parse_args()
    logging.info("Scanning file to determine limits") 
    limits = get_bounds(argp.file)

    metadata = open(argp.metadata)
    tiler = Datatiler(1,2000,limits[0],limits[1],headers = ["x","y","id"])
    parsed_so_far = 0
    for line in open(argp.file):
        metaline = metadata.readline().rstrip("\n").split("\t")
        point = map(float,line.split("\t"))
        tiler.insert(point + metaline)
        parsed_so_far += 1
    tiler.flush()
    tiler.close_files()
    
    settings = open("data_description.json","w")
    settingdict = {
        "limits":limits,
        "max_zoom":tiler.tile_width
    }
    json.dump(settingdict,settings)
        
if __name__=="__main__":
    main()
