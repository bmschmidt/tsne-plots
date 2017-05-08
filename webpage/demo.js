var scatterplot = infinite_scatter();

var canvas_element = d3.select("#container").append("canvas")
    .style("position","absolute")
    .style("top",0)
    .style("left",0)
//    .style("width","100%")
//    .style("height","100%")
    .attr("width", window.innerWidth)
    .attr("height", window.innerHeight)
    .style("background-color","rgba(248, 227, 214, 0.05)")
//    .style("background-color","black")

scatterplot.canvas(canvas_element);
scatterplot.create();


function setup_query_box() {
    search = d3.select("#buttons").append("input").attr("id","search")

    search.on("keyup",function(d) {
        if (d3.event.key=="Enter") {
            scatterplot.zoom_to_word(d3.select("#search").node().value)
        }
    })
    search.append("button").text("find word").on("click",function(d) {
        scatterplot.zoom_to_word(d3.select("#search").node().value)
    })
}

setup_query_box()
