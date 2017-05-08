function infinite_scatter() {

    var that = {}
    var max_index_size = 1e05;

    var wordlist = "_"
    var word_index = {};

    var canvas_element;
    var click_function = function(d) {
	console.log(d)
//	alert(d.ID)
    }
    /**
       function() {
        console.log(d)
        window.open("http://babel.hathitrust.org/cgi/pt?id=" + d.id)
    })**/

    
    that.canvas = function (x) {
	if (x) {
	    canvas_element = x;
	    width = x.attr("width")
	    height = x.attr("height")
	    return that;	    
	} else {
	    return canvas_element;
	}
    }

    that.click = function(x) {
	if (x) {
	    click_function = x;
	    return that;	    
	} else {
	    return click_function;
	}
    }


    that.zoom_to_word = function(word, duration)  {


        // Zoom to a particular id on the chart.

        // Wait for the file to load.
        if (wordlist=="_") {setTimeout(function() {that.zoom_to_word(word)}, 500)}

        if (word_index[word]) {
            var p = word_index[word];
            that.zoom_to(+p[0],+p[1],+p[2],duration)
            return;
        }

        var fname
        wordlist.some(function(chunk) {
            if (word < chunk.end) {
                fname = chunk.file
                return true
            }
            return false;
        })

        if (word_index.length > max_index_size) {
            word_index = {};
        }

        if (!fname) {return}

        d3.tsv(fname, function(data) {
            window.dat = data;
            data.forEach(function(d) {
                word_index[d.id] = [d3.max([32,d.z*1.8]),d.x_,d.y_]
            })
            if (word_index[word]) {
                that.zoom_to_word(word)
            }
        })
    }

    d3.tsv("index_desc.tsv",function(err,data) {
        if (err) {
            wordlist = err;
        }
        wordlist = data
    })


    var prefs =
        {
            "label_field": "id",
            "colorize_by": "goodness",
            "id": "id",
            "scale_type" : {
                "genderedness":"gradient2"          ,
                "goodness":"gradient2"
            }
        }


    var colors = ["goodness","genderedness","language","lc1"]
    var labels  = ["id","title","lc1"]



    var draw;
    var redraw;
    function change(key,node) {
        prefs[key] = node.value
        console.log(node.value)
        redraw()
    }

    
    var col_select  = d3.select("#buttons")
        .append("div")
        .text("colorize by: ")
        .append("select")
        .on("change", function(d) {change("colorize_by",this)}),

        col_options = col_select.selectAll('option').data(colors); // Data join

    col_options.enter().append("option").text(function(d) { return d; });


    var col_select  = d3.select("#buttons")
        .append("div")
        .text("label by: ")
        .append("select")
        .on("change", function(d) {change("label_field", this)}),
        col_options = col_select.selectAll('option').data(labels); // Data join

    col_options.enter().append("option").text(function(d) { return d; });

    // Enter selection


    colorizing_select = d3.select("buttons")
        .append("select")

    colorizing = colorizing_select
        .selectAll("option")
        .data(colors)

    colorizing.append("option").text(function(d) {
        return d
    })


    that.create = function () {
        d3.json("data_description.json",function(settings) {
            //    var lim = {"x":settings.limits[0],"y":settings.limits[1]};
            //    var lim = {"x":[0,width],"y":[0,height]}
            zm = d3
                .zoom()
                .scaleExtent([1, settings.max_zoom*4])
            //      .translateExtent([[lim.x[0],lim.y[1]],[lim.x[1],lim.y[0]]])
                .on("zoom",zoomend)


            function zoomend() {
                transform = d3.event.transform;
                // The problem is that *this* is sometimes the canvas and sometimes the svg.
                // svg zooms need to change the canvas transform;

                x = d3.event.transform.rescaleX(x_)
                y = d3.event.transform.rescaleY(y_)
                updateData()
                redraw();
            }




            // zoom is applied to the overlying svg, *not* the underlying canvas.





            var quadtree = function () {
                //replicating v3 generator behavior
                return d3.quadtree()
                    .extent([[settings.limits[0][0],settings.limits[1][0]],[settings.limits[0][1],settings.limits[1][1]]])
                    .x(function(d) {return d.x})
                    .y(function(d) {return d.y})
            }
            canvas = canvas_element
                .node()
                .getContext("2d");

            window.settings = settings

            var svg = d3.select("#container").append("svg")
                .attr("width", width)
                .attr("height", height)
                .style("position","absolute").style("top",0).style("left",0)

            //    svg.call(tip)



            var x_ = d3.scaleLinear()
                .domain(settings.limits[0])
                .range([0,width])

            x = x_

            var y_ = d3.scaleLinear()
                .domain(settings.limits[0])
                .range([0, height]);

            y = y_

            // A cache of everything we've ever seen. It can be pruned, if need be, to
            // release memory. Keys are of the form "z,x,y"
            var stored_tiles = {};

            // A continuously-updated variable that remembers what's in frame.
            var visible_quadrants = d3.set([])

            window.quads = visible_quadrants

            // if greater than one, show tiles from this far down.
            var visibility_threshold = 1.5;



            function update_visible_quadrants(xlim,ylim) {
                visible_quadrants.values().map(function(d) {
                    visible_quadrants.remove(d)
                })
                var zoom_levels = []

                var i = 1;

                while (i/visibility_threshold <= transform.k) {
                    zoom_levels.push(i)
                    i = i*2
                }

                var limits = settings.limits

                zoom_levels.forEach(function(level) {
                    var y_scale = d3.scaleLinear().domain(limits[1]).range([0,level-.00000001])
                    var x_scale = d3.scaleLinear().domain(limits[0]).range([0,level-.00000001])

                    var quads_x = xlim.map(function(x) {
                        return Math.floor(x_scale(x))
                    })

                    var quads_y = ylim.map(function(y) {
                        return Math.floor(y_scale(y))
                    })

                    d3.range(quads_x[0],quads_x[1]+1).forEach(function(x) {
                        d3.range(quads_y[0],quads_y[1]+1).forEach(function(y) {
                            visible_quadrants.add([level,x,y])
                        })
                    })
                })

            }

            function updateData(xlim,ylim) {
                //console.log(xlim,ylim)
                update_visible_quadrants(x.domain(),y.domain())
                visible_quadrants.values().forEach(function(d) {
                    var n = d.split(",")
                    add_tile(n[0],n[1],n[2])
                })

            }

            function add_tile(rz,rx,ry) {
                // If it's there, ain't nothing gotta happen.
                var key = [rz,rx,ry].join(",")
                if (stored_tiles[key]) {
                    // Don't update, even if loading is in progress.
                    return
                }
                if (rz>settings.max_zoom || rz<1) {
                    // Don't try to zoom in farther than the deepest tile, or
                    // wider than tile number 1.
                    return
                }
                if (ry >= (Math.pow(2,(rz-1))) | rx >= Math.pow(2,(rz-1)) | ry < 0 | rx < 0)
                {
                    // These are the outer bounds of the visualization. Don't
                    // bother trying to get tiles outside them; they don't exist.
                    return
                }

                //        console.log('fetching',rz,rx,ry)
                stored_tiles[key] = "fetching"
                d3.tsv("tiles/" + rz + "/" + rx + "/" + ry + ".tsv").row(function(d) {
                    d["zoom"] = rz;
                    d["quadrant"] = key;
                    return d;
                })
                    .get(function(error,foo) {
                        if (error) {return}
                        stored_tiles[key] = {"data":foo, "quadtree":quadtree([])}
                        canvas.clearRect(0, 0, width, height)
                        foo.forEach(function(d) {
                            stored_tiles[key]["quadtree"].add(d)
                        })
                        var current;
                        svg
                            .on("mousemove",handleMousemove)
                            .on("click",handleMousemove)
                            .call(zm)
                        draw();
                    })
            }

            transform  = d3.zoomIdentity

            console.log("welcome")

            that.zoom_to = function(zoom_level, x_pt, y_pt, transition_time) {
                transition_time = transition_time || 7000

                var new_point = d3.zoomIdentity
                    .translate(width/2,height/2)
                    .scale(zoom_level)
                    .translate(-x_(x_pt), -y_(y_pt));

                d3.select("svg")
                    .transition()
                    .duration(transition_time)
                    .ease(d3.easeCubicInOut)
                    .call(zm.transform,new_point)

                transform = new_point;
            }



            presets = [

                {"name":"The Civil War",
                 "function": function () {that.zoom_to(50, -5.968966, -7.610941)}
                },
                {
                    "name":"Sports",
                    "function": function() {
                        that.zoom_to(300, -4.197554, -6.701161)
                    }
                },
                {
                    "name":"Shakespeare Plays",
                    "function" : function() {that.zoom_to(72,-18.7,22.47)}
                },
                {"name":"Translations of French literature to English",
                 "function": function() {that.zoom_to( 176.54059925813115 , 5.0485406524096685 , 17.813947984398695 )},
                },
                {"name":"Handwritten Thai-language texts (including many mislabeled as English)",
                 "function":function() {that.zoom_to( 400 , -37.696399637066 , 35.37618266954921 )}
                },
                {"name":"Inventories of Archives","function":function() {that.zoom_to( 400 , 36.120996932462035 , 6.961118729653128 )}},
                {"name":"German Language Art and Art History","function":function() {that.zoom_to( 89.37851623567869 , -23.268504505192816 , -16.63445312964734 )}},
                {"name":"College Course Catalogs","function":function() {that.zoom_to( 29.89847510026179 , -32.72892997627423 , 5.183329926244259 )}},
                {
                    "name":"Bad OCR -- instrumental music",
                    "function": function() {that.zoom_to(400,34,-13.8)}
                },
                {
                    "name":"Bad OCR -- sideways government reports",
                    "function": function() {that.zoom_to(157, 33, -14.5)}
                },
                {
                    "name":"Bad OCR -- opera or songs, sheet music (or other text?)",
                    "function": function () {that.zoom_to(230, 33.75, -15.32)}
                },
                {"name": "Bibliographies of Spanish Language Literature in English, French, and Spanish",
                 "function":function() {that.zoom_to( 195.09053828349118 , -8.362253318933025 , 17.878280187462835 )}},


                { "name": "Patent Records, multiple sources","function":function() {
                    that.zoom_to(93,38.7,-20.8)
                }}

            ]



            presets = [];

            buttons = d3.select("#buttons").append("div").attr("display","float").selectAll("button").data(presets)
            buttons.enter().append("button").on("click",function(d) {d["function"]()}).text(function(d) {return d.name})


            redraw = function() {
                // Draw is called more often than redraw.
                canvas.clearRect(0, 0, width, height);
                svg.selectAll("circle").remove()
                draw();
            }

            col1 = 'rgba(40,225,40,0.75)'
            //col2 = 'rgba(225,40,40,0.75)'
            //col3 = 'rgba(225,40,40,0.75)'
            //colors = d3.scale.category10().domain([1,2,4,8,16])


            colors = d3.scaleOrdinal(d3.schemeCategory20)

            if (prefs.scale_type[prefs.colorize_by] == "gradient2") {
                colors = d3.scaleLinear().domain([-.4,0,.4]).range(["blue","grey","red"])
            }

            function draw() {
                canvas.fill()

                canvas.textAlign="center";
                var d, cx, cy;
                canvas.beginPath();
                var vals = visible_quadrants.values()
                vals.sort()
                vals.reverse()
                vals.forEach(function(quadrant) {
                    var cached_tile = stored_tiles[quadrant]
                    if (cached_tile=="fetching") {return}
                    if (!cached_tile) {return}
                    canvas.globalAlpha = 0.6
                    stored_tiles[quadrant].data.forEach(function(d) {
                        if (d.zoom/visibility_threshold <= transform.k) {
                            cx = x(d.x);
                            cy = y(d.y);

                            if (prefs.colorize_by) {
                                if (!d[prefs.colorize_by]) {
                                    canvas.fillStyle = "rgba(200, 200, 200, 0.3)"
                                } else {
                                    if (prefs.colorize_by=="lc1") {
                                        canvas.fillStyle = colors(d[prefs.colorize_by].substr(0,1))
                                    } else {
                                        canvas.fillStyle = colors(d[prefs.colorize_by])
                                    }
                                }
                            } else {
                                canvas.fillStyle = col1//colors(d.zoom)
                            }

                            if ((d.zoom*4 <= transform.k | d.zoom==1) && prefs.label_field) {
                                canvas.font = d3.max([10,Math.log(transform.k/d.zoom)*6]) + 'px Arial'
                                canvas.save()
                                canvas.translate(cx, cy);
                                canvas.rotate(90*d[prefs.colorize]);
                                canvas.textAlign = "center";
                                canvas.fillText(d[prefs.label_field],0,0);
                                //                  canvas.fillText("Your Label Here", labelXposition, 0);
                                //**/
                                //                  canvas.rotate(90*d[prefs.colorize_by], cx, cy);

                                canvas.restore()
                            } else {
                                //console.log(transform.k)
                                canvas.moveTo(cx, cy);
                                canvas.beginPath()
                                canvas.arc(cx, cy, 2.5, 0, 2 * Math.PI);
                                canvas.closePath()
                                //              canvas.stroke()
                                canvas.fill()
                            }
                        }
                    })
                })

            }


            var current;
            function handleMousemove() {
                event = d3.mouse(this)
                var [xp,yp] = [event[0],event[1]]

                var neighbors = visible_quadrants.values().map(function(quad_name) {
                    // Search all the visible quadtrees for the point.
                    // It may be just offscreen, alas.

                    // Nonexistent tiles return nothing.
                    if (!stored_tiles[quad_name]) {return false}

                    var zooml = quad_name.split(",")[0]

                    //
                    if (zooml*4 <= transform.k | zooml==1) {
                        // Already labeled?
                        //              return false
                    }

                    var quadData = stored_tiles[quad_name]["quadtree"]
                    // Empty tiles return nothing.
                    if (!quadData) {return false}



                    var point = quadData.find(x.invert(xp),y.invert(yp))

                    //      console.log([xp,yp],[point.x,point.y],[x(point.x),y(point.y)])
                    point.dist = Math.sqrt(Math.pow(xp-x(point.x),2) + Math.pow(yp-y(point.y),2))
                    return point
                })
                    .filter(function(d) {return d}) //filter to truthy values.

                neighbors = neighbors.sort(function(a,b) {
                    return a.dist - b.dist
                })

                if (neighbors.length==0) {return false}

                var closest = neighbors[0]
                // Don't find points that are more than 20 pixels away.
                if (closest.dist > 10) {return false}
                if (current != closest[prefs.id]) {
                    current = closest[prefs.id]
                    circle = svg.selectAll("circle").data([closest])
                    circle.enter().append("circle").style("stroke","red").attr("r",6).style("opacity",.5).style("fill","green").style("fill-opacity",0.7)

                    var cx = x(closest.x)
                    var cy = y(closest.y)
                    circle
                        .attr("cx",cx)
                        .attr("cy",cy)
                        .on("click",click_function)

                    //      console.log(cx,closest.x,cy,closest.y)

                    var html = function(d) {
                        closest.year = closest.year || "????"
                        display_string = closest.title + "(" + closest.year + ")" + " (in " + closest.language + ")"
                        return closest.lc1 ? display_string  + "<br>LC class: " + closest.lc1 : display_string
                        //              var rows = d3.keys(d).map(function(key) {
                        //                  return("<span col='red'>" + key  + ":</span> " + "<span col='black'>" + d[key]  + "</span>")
                        //              })
                        return rows.join("<br>")
                    }

                    //      tip.html(html(closest))
                    //            tip.show()
                    //            d3.jsonp("http://catalog.hathitrust.org/api/volumes/brief/json/htid:" + current + "&callback=updateBlock")
                }
            }

            updateData(settings.limits[0],settings.limits[1])

        })
    }
    function updateBlock(jsonp) {
        // Hathi trust only.
        var floo=jsonp;
        var record = floo[d3.keys(floo)[0]].records
        var record = record[d3.keys(record)[0]]
        tip.hide()
        tip.html(record["titles"][0] + ", " + record["publishDates"][0] )
        console.log()
        tip.show(awooga.node())
    }

    //var tip = d3.tip()
    //    .attr('class', 'd3-tip')
    //    .offset([-10, 0])

    that.where_am_i = function() {
        console.log('{"name":"Untitled","function":function() {that.zoom_to(',transform.k,",",x.invert(window.innerWidth/2),",",y.invert((window.innerHeight-100)/2),")}},")
    }

    return that;
}
