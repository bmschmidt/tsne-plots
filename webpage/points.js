

d3.json("data_description.json",function(settings) {

    var width = window.innerWidth,
    height = window.innerHeight;

    width = 1200
    height= 700
    var canvas_element = d3.select("#container").append("canvas")
        .style("position","absolute").style("top",0).style("left",0)
        .attr("width", width)
        .attr("height", height)
    .style("background-color","rgba(248, 227, 214, 0.05)") 


    quadtree = d3.geom.quadtree()
        .extent([[settings.limits[0][0],settings.limits[1][0]],[settings.limits[0][1],settings.limits[1][1]]])
        .x(function(d) {return d.x})
        .y(function(d) {return d.y})

    var canvas = canvas_element
        .node()
        .getContext("2d");



    window.settings = settings

    var svg = d3.select("#container").append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("position","absolute").style("top",0).style("left",0)


    var x = d3.scale.linear()
        .domain(settings.limits[0])
        .range([0,width])

    y = d3.scale.linear()
        .domain(settings.limits[0])
        .range([0, height]);

    // A cache of everything we've ever seen. It can be pruned, if need be, to
    // release memory. Keys are of the form "z,x,y"
    var stored_tiles = {};

    // A continuously-updated variable that remembers what's in frame.
    var visible_quadrants = d3.set([])

    window.quads = visible_quadrants

    function update_visible_quadrants(zoom,xlim,ylim) {
	visible_quadrants.values().map(function(d) {
	    visible_quadrants.remove(d)
	})
        var zoom_levels = []

        var i = 1;
        while (i<=zoom) {
            zoom_levels.push(i)
            i = i*2
        }

        var limits = settings.limits

/**        var corners = [
            [xlim[0],ylim[0]],
            [xlim[1],ylim[0]],
            [xlim[0],ylim[1]],
            [xlim[1],ylim[1]]
        ]
**/
        zoom_levels.forEach(function(level) {
            var y_scale = d3.scale.linear().domain(limits[1]).range([0,level-.00000001])
            var x_scale = d3.scale.linear().domain(limits[0]).range([0,level-.00000001])

//            corners = corners.forEach(function(corner) {
//                return [Math.floor(x_scale(corner[0])),Math.floor(y_scale(corner[1]))]
//            })
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

    function updateData(zoom,xlim,ylim) {
	console.log(xlim,ylim)
	update_visible_quadrants(zoom,xlim,ylim)

        visible_quadrants.values().forEach(function(d) {
            var n = d.split(",")
            add_tile(n[0],n[1],n[2])
        })

    }

    function add_tile(rz,rx,ry) {
        // If it's there, ain't nothing gotta happen.
        var key = [rz,rx,ry].join(",")
//        console.log(key)
        if (stored_tiles[key]) {
            // Don't update, even if loading is in progress.
            return
        }
        if (rz>settings.max_zoom || rz<1) {
            //      console.log("no zoom at that level")
            return
        }
        if (ry >= (Math.pow(2,(rz-1))) | rx >= Math.pow(2,(rz-1)) | ry < 0 | rx < 0)
        {
//            console.log("undefined viewport",rz,rx,ry)
                  return
        }

        console.log('fetching',rz,rx,ry)
        stored_tiles[key] = "fetching"
        d3.tsv("tiles/" + rz + "/" + rx + "/" + ry + ".tsv").row(function(d) {
            return {
                "x":+d.x,
                "y":+d.y,
                "ID":d.id,
                "zoom":rz,
                "quadrant":key
            }})
            .get(function(error,foo) {
                if (error) {return}

                stored_tiles[key] = {"data":foo,"quadtree":quadtree([])}

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


    console.log("welcome")


    function zoomend() {
        scale = zm.scale()
        updateData(
            scale,
            [x.invert(0),x.invert(window.innerWidth)],
            [y.invert(0),y.invert(window.innerHeight)])
    }

    var zm = d3.behavior
        .zoom().x(x).y(y)
        .scale(1)
        .scaleExtent([1, 400])
        .size([width,height])
        .on("zoom",zoom)
        .on("zoomend",zoomend)

    zm.translate([-x(0)+width/2,-y(0)+height/2])

    function zoom() {
        canvas.clearRect(0, 0, width, height);
	tip.hide()
	svg.selectAll("circle").remove()
        draw();
    }

    col1 = 'rgba(40,225,40,0.75)'
    col2 = 'rgba(225,40,40,0.75)'
    col3 = 'rgba(225,40,40,0.75)'
    colors = d3.scale.category10().domain([1,2,4,8,16])
    function draw() {
//	canvas.fillStyle = 'rgba(255,225,40,0.1)';
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
            stored_tiles[quadrant].data.forEach(function(d) {
                if (d.zoom <= zm.scale()) {
                    cx = x(d.x);
                    cy = y(d.y);

                    canvas.fillStyle = d.ID.includes("_") ? col1 : col2
		    canvas.fillStyle = colors(d.zoom)


		    if (d.zoom*4 <= zm.scale() | d.zoom==1) {

			canvas.font = d3.max([10,Math.log(zm.scale()/d.zoom)*6]) + 'px Arial'
			canvas.fillText(d.ID,cx,cy);
		    } else {
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

    var tip = d3.tip()
        .attr('class', 'd3-tip')
        .offset([-10, 0])

    svg.call(tip)


    function updateBlock(jsonp) {
        // Hathi trust only.
        var floo=jsonp;
        var record = floo[d3.keys(floo)[0]].records
        var record = record[d3.keys(record)[0]]
        tip.html(record["titles"][0] + ", " + record["publishDates"][0] )
        tip.show()
    }


    var current;
    function handleMousemove() {
        event = d3.mouse(this)
        var [xp,yp] = [event[0],event[1]]

        var neighbors = visible_quadrants.values().map(function(quad_name) {
            // Search all the visible quadtrees for the point.
            // It may be just offscreen.

	    // Nonexistent tiles return nothing.
	    if (!stored_tiles[quad_name]) {return false}

	   
	    var zooml = quad_name.split(",")[0]

	    if (zooml*4 <= zm.scale() | zooml==1) {
		return false
	    }

            var quadData = stored_tiles[quad_name]["quadtree"]
	    // Empty tiles return nothing.
            if (!quadData) {return false}

	    var point = quadData.find([x.invert(xp),y.invert(yp)])

            point.dist = Math.sqrt(Math.pow(x.invert(xp)-point.x,2) + Math.pow(y.invert(yp)-point.y,2))

            return point
        })
            .filter(function(d) {return d}) //filter to truthy values.
	
        neighbors = neighbors.sort(function(a,b) {
	    return a.dist - b.dist
        })

	if (neighbors.length==0) {return false}
        var closest = neighbors[0]
	
        if (current != closest.ID) {
            current = closest.ID
            circle = svg.selectAll("circle").data([closest])
            circle.enter().append("circle").style("stroke","red").attr("r",6).style("opacity",.5).style("fill","green").style("fill-opacity",0.7)

            //                            circle.on("click",function() {
            //                                window.open("http://babel.hathitrust.org/cgi/pt?id=" + current)
            //                            })

            circle.attr("cx",x(closest.x))
            circle.attr("cy",y(closest.y))

            tip.html(closest.ID)
            tip.show()

            //                            d3.jsonp("http://catalog.hathitrust.org/api/volumes/brief/json/htid:" + closest.ID + "&callback=updateBlock")
        }
    }

    updateData(1,settings.limits[0],settings.limits[1])
})
