var map;
var layerControl;
var heat;
var self_drawn;
var L;
var locs;
var stats;
var chi_vals
var center = [50.7153146, 7.11007902];
var currentCSV;
var currentTopic;
var currentMode;
var currentModeNormalOrBestLoc;
var currentMargin;
var hexLayer;
var currentRadiusMode;
var breakMode; //["equal_breaks", "quantile", "jenks_natural_breaks"];
var allBreakpointsJson 
var CSV;

// colorbrewer2 palettes, blues and greens, single hue 
// https://colorbrewer2.org/#type=sequential&scheme=Blues&n=7 | https://colorbrewer2.org/#type=sequential&scheme=Greens&n=7

var colorbrewerBlues = ['#eff3ff','#c6dbef','#9ecae1','#6baed6','#4292c6','#2171b5','#084594']
var colorbrewerGreens = ['#edf8e9','#c7e9c0','#a1d99b','#74c476','#41ab5d','#238b45','#005a32']
var colorbrewerRedsWhiteGreens = ['#de2d26','#fc9272', '#fee0d2', '#ffffff', '#e5f5e0','#a1d99b','#31a354']
var colorbrewerRedTransparentGreens = ['#fcae91','#ffffff00','#a1d99b','#74c476','#41ab5d','#238b45','#005a32']//,'#edf8e9','#bae4b3','#74c476','#31a354','#006d2c']
var colorbrewerRedTransparentBlues = ['#fcae91','#ffffff00', '#eff3ff','#bdd7e7','#6baed6','#3182bd','#08519c']
var colorbrewerRedsTransparentBlues = ['#de2d26', '#fc9272', '#fee0d2', '#ffffff00','#deebf7','#9ecae1','#3182bd']

$(document).ready(function () {
    var osmUrl = 'http://{s}.tile.osm.org/{z}/{x}/{y}.png';
    var osmAttrib = '&copy; <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    var osm = L.tileLayer(osmUrl, {
            maxZoom: 18,
            attribution: osmAttrib
        });


    function initialize_map(focus_coordinates = center, zoom_level = 12) {
        // initialize the map on the "map" div with a given center and zoom
        map = L.map('map', {
            fullscreenControl: true,
        }).setView(focus_coordinates, zoom_level).addLayer(osm);

        L.control.scale().addTo(map);
        L.Control.geocoder().addTo(map);
        L.control.polylineMeasure().addTo(map);
        layerControl = L.control.layers().addTo(map);
        L.control.bigImage().addTo(map);
        $('.leaflet-pm-icon-marker').parent().hide();
        $('.leaflet-pm-icon-circle-marker').parent().hide();
        $('.leaflet-pm-icon-polyline').parent().hide();
    }

    window.remove_layer = function (layr) {
        map.removeLayer(layr);
        layerControl.removeLayer(layr)
    }
    
    window.add_layer = function (layr, layr_name) {
        map.addLayer(layr);
        layerControl.addOverlay(layr, layr_name);
    }

    initialize_map();

    window.remove_all_hex_layer = function(){
        // to do
        map.eachLayer(function(layer) {
            if (("duration" in layer.options)) {
            map.removeLayer(layer);
                layerControl.removeLayer(layer);
            }
        });
    }

    // function for creating 5 classes based on different modes 
    function calculateBreakpoints(mode, data) {
        data.sort((a, b) => a - b);
        let breakpoints = [];
        const min = ss.min(data);
        const max = ss.max(data);
        const interval = mode === "quantile" ? data.length / 5 : (max - min) / 4;
        switch (mode) {
            case "equal_breaks":
                for (let i = 0; i <= 4; i++) {
                breakpoints.push(min + i * interval);
                }
                break;
            case "quantile":
                for (let i = 1; i <= 4; i++) {
                const index = Math.round(i * interval) - 1;
                breakpoints.push(data[index]);
                }
                break;
            case "jenks_natural_breaks":
                breakpoints.push(...ss.jenks(data, 4));
                break;
            case "head_tail_breaks":
                const median = ss.median(data);
                const headGroup = data.filter(value => value >= median);
                const tailGroup = data.filter(value => value < median);
                const tailMax = ss.max(tailGroup);
                const headMin = ss.min(headGroup);
                breakpoints.push(tailMax, headMin);
                break;
            case "standard_deviation":
                const dataMean = ss.mean(data);
                const dataStdDev = ss.sampleStandardDeviation(data);
                breakpoints.push(dataMean - dataStdDev, dataMean, dataMean + dataStdDev);
                break;
            case "z_score":
                const zScores = data.map(value => (value - ss.mean(data)) / ss.sampleStandardDeviation(data));
                for (let i = -2; i <= 2; i++) {
                    const zScoreBreakpoint = ss.mean(zScores) + i * ss.sampleStandardDeviation(zScores);
                    breakpoints.push(zScoreBreakpoint);
                }
                break;
          default:
            throw new Error("Invalid mode");
        }
        breakpoints.unshift(min);
        breakpoints.push(max);
        return Array.from(new Set(breakpoints)).sort((a, b) => a - b).slice(0, 5);
      }
      
      function getAllBreakpoints(data) {
        const modes = ["equal_breaks", "quantile", "jenks_natural_breaks", "head_tail_breaks"] // "standard_deviation","z_score" could be implemented
        const allBreakpoints = {};
        for (let mode of modes) {
          allBreakpoints[mode] = calculateBreakpoints(mode, data);
        }
        return allBreakpoints;
      }
      
      function getClassIndex(number, breakpoints) {
        if (number < breakpoints[0]) {
          return 1;
        }
        for (let i = 0; i < breakpoints.length - 1; i++) {
          if (number >= breakpoints[i] && number < breakpoints[i + 1]) {
            return i + 2;
          }
        }
        return 5;
      }
      // returns a value from 1-5

    function updateColorValueFunction(){

        // only for chi: calculate chi for all hexbins in advance for finding the right breakpoints 
        if (currentMode == "posts_hex_chi"){

            var allChis = currentCSV.data.map(function (obj) {
                return (((obj["posts_match"]*currentCSV.norm)-obj["posts_sum"])/
                        (Math.pow(obj["posts_sum"], 1/2)));
            });

            allChis = allChis.filter((x) => x >= 3.84); // important! remove values below 3.84 as they get manually assigned colors
            allBreakpointsJson = getAllBreakpoints(allChis);
            
        }


        //console.log("Color update:",currentMode,currentMargin, currentTopic)
        hexLayer.colorValue(function(d) { 
            // bin stats
            var posts_match = d.reduce(function (acc, obj) { return acc + obj["o"]["posts_match"]; }, 0); 
            var posts_sum = d.reduce(function (acc, obj) { return acc + obj["o"]["posts_sum"]; }, 0);
            var posts_mean = posts_match / posts_sum
            var posts_chi = ((posts_match*currentCSV.norm)-posts_sum)/(Math.pow(posts_sum, 1/2));

            // best rel location stats
            var max_rel_obj = d.reduce(function (prev, current) {
                return (prev["o"]["posts_match"]/prev["o"]["posts_sum"] >
                     current["o"]["posts_match"]/current["o"]["posts_sum"]) ? prev : current;});
            max_rel_obj = max_rel_obj["o"]

            var posts_match_best_rel_loc = max_rel_obj["posts_match"];
            var posts_sum_best_rel_loc = max_rel_obj["posts_sum"];
            var posts_mean_best_rel_loc = posts_match_best_rel_loc/posts_sum_best_rel_loc;
            var posts_chi_best_rel_loc = ((max_rel_obj["posts_match"]*currentCSV.norm)-max_rel_obj["posts_sum"])/(Math.pow(max_rel_obj["posts_sum"], 1/2));
    
            // best chi location stats
            var max_chi_obj = d.reduce(function (prev, current) {
                return (((prev["o"]["posts_match"]*currentCSV.norm)-prev["o"]["posts_sum"])/
                        (Math.pow(prev["o"]["posts_sum"], 1/2))  >
                       ((current["o"]["posts_match"]*currentCSV.norm)-current["o"]["posts_sum"])/
                        (Math.pow(current["o"]["posts_sum"], 1/2)) ? prev : current)});
            max_chi_obj = max_chi_obj["o"]

            var posts_match_best_chi_loc = max_chi_obj["posts_match"];
            var posts_sum_best_chi_loc = max_chi_obj["posts_sum"];
            var posts_mean_best_chi_loc = posts_match_best_chi_loc/posts_sum_best_chi_loc;
            var posts_chi_best_chi_loc = ((max_chi_obj["posts_match"]*currentCSV.norm)-max_chi_obj["posts_sum"])/(Math.pow(max_chi_obj["posts_sum"], 1/2));
    
            // functions for posts_hex_abs, posts_hex_rel, posts_hex_dif, posts_hex_chi

            // 1 ##################### ABSOLUTE #######################################
            if (currentMode =="posts_hex_abs"){
                return (posts_match / currentCSV.posts_match_max )*6 // max len of colors - 1 as arrray starts at 0!
                // division only for color scale
            }
            // 2 ##################### RELATIVE #######################################
            else if (currentMode =="posts_hex_rel"){
                var this_mean = (currentModeNormalOrBestLoc == "bestLocMode") ? posts_mean_best_rel_loc : posts_mean;

                // greater than average
                if (this_mean > (currentCSV.mean + currentMargin)){
                    return 6 // green
                }
                else if (this_mean < (currentCSV.mean - currentMargin)){
                    return 0 // red
                }
                else{return 3} // white, transparent
            }
            // 3 ####################### CHI ##########################################
            else {//(currentMode == "posts_hex_chi"){

                var chi = (currentModeNormalOrBestLoc == "bestLocMode") ? posts_chi_best_chi_loc : posts_chi;
                // standard_deviation and z_score could be implemented here

                if      (chi <  -3.84)                   {return 0} // red
                else if (chi >= -3.84   && chi <= 3.84  ){return 1} // transparent
                else                                     {return 1 + getClassIndex(chi,allBreakpointsJson[breakMode])}
            }

        })

        if (currentMode =="posts_hex_abs"){
            hexLayer.colorRange(colorbrewerBlues).redraw()
        }
        // 2 ##################### RELATIVE #######################################
        else if (currentMode =="posts_hex_rel"){
            hexLayer.colorRange(colorbrewerRedsTransparentBlues).redraw()
        }
        // 3 ####################### CHI ##########################################
        else {//(currentMode == "posts_hex_chi"){
            hexLayer.colorRange(colorbrewerRedTransparentBlues).redraw()
        }

        hexLayer.redraw()
    }
    
    function tooltip_function(d) {
        // bin stats
        var posts_match = d.reduce(function (acc, obj) { return acc + obj["o"]["posts_match"]; }, 0); 
        var posts_sum = d.reduce(function (acc, obj) { return acc + obj["o"]["posts_sum"]; }, 0);
        var posts_mean = posts_match / posts_sum
        var posts_chi = ((posts_match*currentCSV.norm)-posts_sum)/(Math.pow(posts_sum, 1/2));

        // best rel location stats
        var max_rel_obj = d.reduce(function (prev, current) {
            return (prev["o"]["posts_match"]/prev["o"]["posts_sum"] >
                current["o"]["posts_match"]/current["o"]["posts_sum"]) ? prev : current;});
        max_rel_obj = max_rel_obj["o"]

        var posts_match_best_rel_loc = max_rel_obj["posts_match"];
        var posts_sum_best_rel_loc = max_rel_obj["posts_sum"];
        var posts_mean_best_rel_loc = posts_match_best_rel_loc/posts_sum_best_rel_loc;
        var posts_chi_best_rel_loc = ((max_rel_obj["posts_match"]*currentCSV.norm)-max_rel_obj["posts_sum"])/(Math.pow(max_rel_obj["posts_sum"], 1/2));

        // best chi location stats
        var max_chi_obj = d.reduce(function (prev, current) {
            return (((prev["o"]["posts_match"]*currentCSV.norm)-prev["o"]["posts_sum"])/
                    (Math.pow(prev["o"]["posts_sum"], 1/2))  >
                ((current["o"]["posts_match"]*currentCSV.norm)-current["o"]["posts_sum"])/
                    (Math.pow(current["o"]["posts_sum"], 1/2)) ? prev : current)});
        max_chi_obj = max_chi_obj["o"]

        var posts_match_best_chi_loc = max_chi_obj["posts_match"];
        var posts_sum_best_chi_loc = max_chi_obj["posts_sum"];
        var posts_mean_best_chi_loc = posts_match_best_chi_loc/posts_sum_best_chi_loc;
        var posts_chi_best_chi_loc = ((max_chi_obj["posts_match"]*currentCSV.norm)-max_chi_obj["posts_sum"])/(Math.pow(max_chi_obj["posts_sum"], 1/2));

        /////////////////////////////////////////////////////

        var locations = d.reduce(function (acc, obj) {acc.push(obj["o"]["node.location_id"]);return acc;}, []);
            locations = [...new Set(locations)]

            let locationsHTML = ""; // initialize result variable as empty string

            for (let i = 0; i < locations.length; i++) {
            const element = locations[i];
            const href = `https://www.instagram.com/explore/locations/${element}`; // generate href attribute
            const link = `<a href="${href}" target="_blank">${element}</a>`; // wrap element in a tag
            locationsHTML += link + "<br>"; // concatenate link and <br> tag to result
            }

        // plain html version
        var tooltip_text_plain =
            `Bin Statistics<br>
            Topic Posts: ${String(posts_match)}<br>
            All Posts: ${String(posts_sum)}<br>
            Mean: ${((posts_mean)*100).toFixed(2)}%<br>
            Signed Chi: ${String(posts_chi.toFixed(2))}<br><br>   

            Best Relative Location Statistics<br>
            Topic Posts: ${String(posts_match_best_rel_loc)}<br>
            All Posts: ${String(posts_sum_best_rel_loc)}<br>
            Mean: ${((posts_mean_best_rel_loc)*100).toFixed(2)}%<br>
            Signed Chi: ${String(posts_chi_best_rel_loc.toFixed(2))}<br>  

            Best Chi Location Statistics<br>
            Topic Posts: ${String(posts_match_best_chi_loc)}<br>
            All Posts: ${String(posts_sum_best_chi_loc)}<br>
            Mean: ${((posts_mean_best_chi_loc)*100).toFixed(2)}%<br>
            Signed Chi: ${String(posts_chi_best_chi_loc.toFixed(2))}<br>  
            `
        // table version
        var tooltip_text =
        `<table>
            <tr>
                <th colspan="2">Bin Statistics</th>
            </tr>
            <tr>
                <td>Topic Posts:</td>
                <td>${String(posts_match)}</td>
            </tr>
            <tr>
                <td>All Posts:</td>
                <td>${String(posts_sum)}</td>
            </tr>
            <tr>
                <td>Mean:</td>
                <td>${((posts_mean)*100).toFixed(2)}%</td>
            </tr>
            <tr>
                <td>Signed Chi:</td>
                <td>${String(posts_chi.toFixed(2))}</td>
            </tr>
            <tr>
                <th colspan="2">Best Relative Location Statistics</th>
            </tr>
            <tr>
                <td>Topic Posts:</td>
                <td>${String(posts_match_best_rel_loc)}</td>
            </tr>
            <tr>
                <td>All Posts:</td>
                <td>${String(posts_sum_best_rel_loc)}</td>
            </tr>
            <tr>
                <td>Mean:</td>
                <td>${((posts_mean_best_rel_loc)*100).toFixed(2)}%</td>
            </tr>
            <tr>
                <td>Signed Chi:</td>
                <td>${String(posts_chi_best_rel_loc.toFixed(2))}</td>
            </tr>
            <tr>
                <th colspan="2">Best Chi Location Statistics</th>
            </tr>
            <tr>
                <td>Topic Posts:</td>
                <td>${String(posts_match_best_chi_loc)}</td>
            </tr>
            <tr>
                <td>All Posts:</td>
                <td>${String(posts_sum_best_chi_loc)}</td>
            </tr>
            <tr>
                <td>Mean:</td>
                <td>${((posts_mean_best_chi_loc)*100).toFixed(2)}%</td>
            </tr>
            <tr>
                <td>Signed Chi:</td>
                <td>${String(posts_chi_best_chi_loc.toFixed(2))}</td>
            </tr>
        </table>`
    

        $("#locations").html(locationsHTML)
        return tooltip_text
    }


    function create_hexlayer(){

        remove_all_hex_layer()

        var options = {
            //radius : 12,
            opacity: 0.75,
            duration: 200,
            colorScaleExtent: [ 0,6 ]
        };

        hexLayer = L.hexbinLayer(options).addTo(map)
        //hexLayer.colorScale().range(['white', 'blue']);

        hexLayer
            .radiusRange([4, 12])
            .lat(function(d) { return d["lat"]; })
            .lng(function(d) { return d["lon"]; }).hoverHandler(L.HexbinHoverHandler.compound({
                handlers: [
                    L.HexbinHoverHandler.resizeFill(),
                    L.HexbinHoverHandler.tooltip({ tooltipContent: tooltip_function})
                ]
            }
            ));



        updateColorValueFunction();
        updateRadius();
        add_layer(hexLayer,"Hexbins");

        hexLayer.data(currentCSV.data);


    }

    function updateRadius(){
        if (currentRadiusMode == "postsMatchRadius"){
            hexLayer.radiusValue(function(d) {
                var posts_match = d.reduce(function (acc, obj) { return acc + obj["o"]["posts_match"]; }, 0);
                return posts_match;
               });
        }
        else{
            hexLayer.radiusValue(function(d) {return 12;});
        }
        hexLayer.redraw()
    }

    window.remove_layer = function (layr) {
        map.removeLayer(layr);
        layerControl.removeLayer(layr)
    }
    
    window.add_layer = function (layr, layr_name) {
        map.addLayer(layr);
        layerControl.addOverlay(layr, layr_name);
    }

    function papa_load_csv(topic){
        Papa.parse("data/" + topic + ".csv", {
            download: true,
            dynamicTyping: true, skipEmptyLines: true,
            header: true,
            complete: function(results) {
                // Execute placeholder function with parsed data
                //console.log("Parsed data:", results.data);
                //placeholderFunction1(results.data);
                var csv_data = results.data;
                var csv_posts_match = csv_data.reduce(function (acc, obj) { return acc + obj["posts_match"]; }, 0);
                var csv_posts_sum = csv_data.reduce(function (acc, obj) { return acc + obj["posts_sum"]; }, 0);

                // max value of posts_match, needed for absolute viz
                const csv_posts_match_max = csv_data.reduce((max, obj) => {return obj.posts_match > max ? obj.posts_match : max;}, -Infinity);

                currentCSV = {"name":topic, 
                              "posts_match": csv_posts_match,
                              "posts_match_max": csv_posts_match_max,
                              "posts_sum":csv_posts_sum,
                              "mean": csv_posts_match/csv_posts_sum,
                              "norm": csv_posts_sum/csv_posts_match,
                              "data":csv_data}

                $(".currentMean").text(
                    `${(currentCSV.mean).toFixed(3)}`// (or ${(currentCSV.mean*100).toFixed(1)}%)`
                    
                    
                    )

                create_hexlayer();
                

            }
        }
        )

    }


        // Get selected value of topic dropdown menu
        currentTopic = $("#topic").val();
        currentMode = $("#vizmode").val();
        breakMode = $("#breakMode").val();
        currentMargin = parseFloat($("#margin").val());
        currentModeNormalOrBestLoc = $('input[name="flexRadioDefault"]:checked').val()

        if (currentMode == "posts_hex_rel"){
            $("#marginContainer").show()}
        else{$("#marginContainer").hide()}

        if (currentMode != "posts_hex_abs"){
            $("#chiRelColorsContainer").show()}
        else{$("#chiRelColorsContainer").hide()}

        papa_load_csv(currentTopic);
            
    // Add onchange event listener to topic dropdown menu
    $("#topic").on("change", function() {
        currentTopic = $(this).val();
        papa_load_csv(currentTopic);
    });

    // Add onchange event listener to vizmode dropdown menu
    $("#vizmode").on("change", function() {
        currentMode = $("#vizmode").val()
        updateColorValueFunction();

        if (currentMode != "posts_hex_abs"){
            $("#chiRelColorsContainer").show()}
        else{$("#chiRelColorsContainer").hide()}

        if (currentMode == "posts_hex_rel"){
            $("#marginContainer").show()}
        else{$("#marginContainer").hide()}

        if (currentMode == "posts_hex_chi"){
            $("#breakModeContainer").show()}
        else{$("#breakModeContainer").hide()}

    });

    $("#marginRange").on("input", function(){ // better change?
        $("#margin").val($("#marginRange").val());
        currentMargin = parseFloat($("#margin").val());
        updateColorValueFunction();
        //document.getElementById('margin').value = value;
    });

    $("#margin").on("change", function(){
        currentMargin = parseFloat($("#margin").val());
        $("#marginRange").val(currentMargin);
        updateColorValueFunction();
    });

    $("#breakMode").on("change", function(){

        breakMode = $("#breakMode").val()
        updateColorValueFunction();
    });

    $('input[name="colorScaleRadio"]').on('change', function() {
        currentModeNormalOrBestLoc = $('input[name="colorScaleRadio"]:checked').val()
        updateColorValueFunction()
        //console.log(currentModeNormalOrBestLoc)
      });
    
    $('input[name="radiusRadio"]').on('change', function() {
        currentRadiusMode = $('input[name="radiusRadio"]:checked').val()
        updateRadius();
        //console.log(currentModeNormalOrBestLoc)
      });

    $(function () {
        $('[data-toggle="tooltip"]').tooltip()
    })
})