/*
    Setup the "app"
*/

// Define our namespace
PL = {}

PL.boot = function() {
    // Load the jquery library
    google.load('visualization', '1.1',{packages: ['corechart']});
    
    //When the page finishes loading, initialize the location 
    window.onload = function() {
        PL.hookupActions();
        PL.populateDropdowns();
        PL.formDefaults = PL.readFormValues();
        PL.fetchProjects();
        
        //Set some defaults
        PL.currentVI = 'nbr';
        PL.chipStyle = 'NL';
        PL.zoomLevel = 2;
        PL.eeRequestBuffer = 20;
        
        //Autosave each minute
        setInterval(PL.saveData, 60000)
    }
}

PL.hookupActions = function() {
    // Save data on sign out
    $("#signout").click(PL.saveData);
    
    // Select a new project
    $("#project_id").change(PL.changeProject);
    
    // Tabs
    $("#vegindex .tab").click(PL.changeTimeseries);
    $("#chipstyle .tab").click(PL.changeChipStyle);    
    
    // Toggle button actions & beginning state
    $(".toggle_button").click(PL.updateToggleButton);
    $(".toggle_button[value=1]").toggleClass('toggle_button_selected')
    
    // Build High-Medium-Low certainty widgets
    var hml_select = ['low', 'medium', 'high'].map(function(x){return '<span class="hml_select_box" value="'+x+'"></span>'}).join('');
    $(".hml_select").html(hml_select);
    $(".hml_select_box").click(PL.HMLclick);
    
    // Chip carousel controls
    $("#carousel .prev").click(PL.showPrevChip);
    $("#carousel .next").click(PL.showNextChip);
    $("#zoom").on("input change", PL.zoomChips);
    $("#monthfilter .toggle_button").click(PL.updateMonthFilters)
}


PL.populateDropdowns = function() {
    // Drop downs for Change Processes, Land Use, and Land Cover
    // can be specified currently in variables at the end of this file
    // and later in the database    
    
    var landuse = PL.LandUseTypes.map(function(x){return '<option>'+x+'</option>'}).join('\n');
    var landcover = PL.LandCoverTypes.map(function(x){return '<option>'+x+'</option>'}).join('\n');
    var change = PL.ChangeProcesses.map(function(x){return '<option>'+x+'</option>'}).join('\n');

    $(".landuse").html(landuse);
    $(".landcover").html(landcover);
    $(".change").html(change);
}


/*
    UI functions for switching projects & plots
*/

// Select a new Project
PL.changeProject = function (){
    // Save any unsaved plot interpretations
    PL.saveData();
    
    // Reset the UI
    PL.fillInForms(PL.formDefaults);
    
    // Present the KML file for download
    $("#kml_download").html('<a href="/chips/prj_'+this.value+'/patches.kmz">KML for Project #'+this.value+'</a>');
    
    // Get a list of active plots
    PL.fetchPlots(this.value);
}

//Loads data about the plot from database and EE/cache
PL.selectPlot = function() {
    // Loading data from EE can take time, be patient
    if (PL.loading) {
        $("#message").prepend("Please Wait! ");
        return;
    }
    
    // Save data if switching to a new plot
    PL.saveData();

    // Update UI and data
    $(".selected_plot").toggleClass('selected_plot', false);
    $(this).toggleClass('selected_plot');
    $("#plot_id").val($(this).attr('value'))
    
    // Get the plot info from the database
    PL.loadPlotInfo();
}


/*
    Functions for reading information about projects & plots from the database and EE/cache
*/

// Read the list of projects to which the current user is assigned
PL.fetchProjects = function() {
    $.ajax({
        url: "actions/fetch_projects.php",
        dataType: 'json',
        error: function(obj, msg, st) {
            $("#message").html('Could not retrieve project list!\n '+msg+' ' + st);
        },
        success: function(R) {
            // Populate the #project_id <select>
            var projects = R.map(function(proj){
                return '<option value="'+proj.project_id+'">'+proj.project_id+': '+proj.project_code+'</option>';
            }).join('\n');
            $("#project_id").html(projects);
            $("#project_id").change();
         }
    });
}

// Read the list of plots in the selected project the current user is assigned to
PL.fetchPlots = function () {
    $.ajax({
        url: "actions/fetch_plots.php",
        data: {project_id: $("#project_id").val()},
        dataType: 'json',
        error: function(obj, msg, st) {
            $("#message").html('Could not retrieve plots list!\n '+msg+' ' + st);
        },
        success: function(R) {
            // Populate the #plot_list
            var plots= R.map(function(plot){
                var iscomplete = plot.iscomplete ? ' iscomplete' : '';
                return '<div class="plotselect'+iscomplete+'" value="'+plot.plot_id+'">['+plot.tsa+'] '+plot.patchinfo_id+'</div>';
            }).join('\n');
            $("#plot_list").html(plots);
            $(".plotselect").click(PL.selectPlot);
         }
    });    
}

// Get plot information from the database
PL.loadPlotInfo = function() {
    $("#message").html('Reading database...');
    
     $.ajax({
        url: "actions/fetch_plot_info.php",
        data:{ plot_id: $("#plot_id").val() },
        dataType: 'json',
        success: function(R) {
                // Initialize the chips object
                PL.chips = {patch: R['patch'],
                            disturbanceYear: R['dist_year'],
                            queue: []
                            };
                // Get chip and timeseries information from EE / cache
                PL.loadLocation();
                
                // Update the UI forms
                PL.fillInForms(R);
            },
        error: function(obj, msg, st) {
                $("#message").html('Could not get plot information! '+msg+' ' +  obj.responseText);
            }
    });
}
    
// Get chip and timeseries data about the patch from EE
PL.loadLocation = function() {
    //If loading chips, stop.  Clear any chips currently there.
    PL.chips.queue = [];
    $("#chips").html('');
    
    // This can take awhile. Set up some UI feedback indicating to wait
    $("#message").html("Asking Mr. Gorelick about " + $(".selected_plot").text() +" ...");
    PL.loading = true;
    $("body").toggleClass('loading', true);
    
    // Now Get data from Google Earth Engine
    $.ajax({
        url: "/lt-chipdata/data",
        method: 'POST',
        data:{
                q: 'chips,chip_bounds,date,'+PL.currentVI,
                patch: PL.chips.patch,
            },
        timeout: 60000,
        dataType: 'json',
        success: function(R) {
                $("#message").html($(".selected_plot").text() +' loaded.');
                // Save information about chips/timeseries in the chips object
                PL.chips.urls = R['chips'];
                PL.chips.timestamps = R['date'];
                PL.chips.suppressed = new Array(R['date'].length);
                PL.chips.bounds = R['chip_bounds'];
                PL.chips.patchSVG = PL.buildPatchSVG();
                
                // Build the Timeseries chart
                PL.chartTimeseries(R['date'], R[PL.currentVI]);
                
                // Move the carousel to the disturbance date
                var targetDate = Date.parse(PL.chips.disturbanceYear + '-06-01');
                PL.carouselGoToDate(targetDate);
            },
        error: function(obj, msg, st) {
                PL.chartTimeseries([],[]);
                PL.chips = {};
                $("#message").html('Could not get data! ');
            },
        complete: function() {
                // Success or error, remove UI loading cues
                PL.loading = false;
                $("body").toggleClass('loading', false);
            }
    });
}


/* 
    Functions for reading/writing interpretation data to/from the User Interface
*/

// Initialize UI forms on plot load to the database values
PL.fillInForms = function(R) {
        
    var R = $.extend({}, PL.formDefaults, R);
    for(name in R) {
        if (name == 'project_id') continue;
        if (name == 'plot_id') continue;
        
        var obj = $("#"+name);
        if (!obj) continue;
                
        if(obj.hasClass('toggle_button')) {
            obj.toggleClass('toggle_button_selected', R[name]==1);
            obj.attr('value', R[name]==1 ? 1 : 0)
        } else if(obj.hasClass('hml_select')) {
            PL.setHML(name, R[name]);
        } else if(obj.is('select')){
            PL.setSelect(name, R[name]);
        } else {
            obj.val(R[name]);
        }
    }
        
    // Initialize the saved data for comparison when saving
    PL.savedData = JSON.stringify(PL.readFormValues());
}

// Collect interpretation data from the DOM.
PL.readFormValues = function() {
    var formvalues = {}
    $("select, textarea, input, .hml_select, .toggle_button").each(function(idx){
        if($(this).val) val = $(this).val();
        if(!val) val = $(this).attr('value');
        
        // If no value is set, val is ''.
        // Keep it this way for unset values; otherwise it's null and unsets the key!
        if(!val) val = '';
        
        formvalues[$(this).attr('id')] = val;
    });
    return formvalues
}

// Save plot interpretations
PL.saveData = function() {
    var formData = JSON.stringify(PL.readFormValues());
    var saved_plot = $(".selected_plot");
    
    // Only save is there is data and it's different from the formData
    if(PL.savedData && PL.savedData != formData) {
        $("#message").html('Saving data...');        
        $.ajax({
            url: "actions/update_interpretation.php",
            method: "GET",
            data:{ data: formData },
            dataType: 'json',
            success: function(R) {
                    $("#message").html('Data saved...');
                    PL.savedData = formData;
                    $(saved_plot).toggleClass('iscomplete', R.iscomplete==1);
                },
            error: function(obj, msg, st) {
                    $("#message").html('Could not save data! '+msg+' ' + st + obj.responseText);
                }
        });
     }
}


/*
    Functions for controling the chip carousel
*/

// Switch between Tasseled Cap and Natural Look
PL.changeChipStyle = function() {
    var oldStyle = PL.chipStyle;
    PL.chipStyle = $(this).attr('value');
    
    $("#chipstyle .tab_selected").toggleClass('tab_selected', false);
    $(this).toggleClass('tab_selected');
        
    $("#chips .chip img").each(function() {
        var url = $(this).css('background-image');
        $(this).css('background-image', url.replace(oldStyle, PL.chipStyle));
    })
}

// On plot load, build an SVG representation of the patch to overlay on each chip
// The patch is translated s.t. it is centered at (0,0)
PL.buildPatchSVG = function() {
    
    var patch = JSON.parse(PL.chips.patch);

    // Determine bounds, patch size and center
    var xBounds = {min:Infinity, max:-Infinity};
    var yBounds = {min:Infinity, max:-Infinity};
    var c = PL.chips.bounds.coordinates[0];
    for (var i=0;i<c.length;i++) {
        xBounds.min = c[i][0] < xBounds.min ? c[i][0] : xBounds.min;
        xBounds.max = c[i][0] > xBounds.max ? c[i][0] : xBounds.max;
        yBounds.min = c[i][1] < yBounds.min ? c[i][1] : yBounds.min;
        yBounds.max = c[i][1] > yBounds.max ? c[i][1] : yBounds.max;
    }
    var range = {}; var center = {};
    range.x = (xBounds.max-xBounds.min);
    range.y = (yBounds.max-yBounds.min);
    center.x = (xBounds.min+xBounds.max)/2;
    center.y = (yBounds.min+yBounds.max)/2;
    
    //A (likely unneeded) helper function
    function round(x, places) {
        var p = Math.pow(10,places);
        return Math.round(x*p)/p;
    }

    // The extent of the SVG
    var viewbox = [-range.x/2, -range.y/2, range.x, range.y].map(function(x){return round(x,6)}).join(' ');
        
    if ($.isNumeric(patch[0])) {
        //When a point is given, the patch is a 5px radius circle
        var patch_svg = '<ellipse x="0" y="0" rx="'+round(range.x/30,6)+'" ry="'+round(range.y/30,6)+'">';
    } else {
        //Build polygons from the patch definition
        var patch_svg = '';
        for(var i=0; i<patch.length;i++) {
            var points = patch[i].map(function(p){
                    return round(p[0]-center.x,6) + ',' + -round(p[1]-center.y,6);
            }).join(' ');
            patch_svg += '<polygon points="'+points+'"  />';
        }
    }

    return '<svg width="300" height="300" viewBox="'+viewbox+'" preserveAspectRatio="none" class="patch_outline">'+patch_svg+'</svg>';
}


// Add a chip to the start or end of the carousel
// If idx isn't specified, add the one immediately before the first or after the last
PL.addChip = function(where, idx) {
    idx = PL.findNearbyChip(where, idx);
    var chip = PL.makeChip(idx);
    
    // Insert the chips, without their images
    if (where == 'start') {
        $("#chips").prepend(chip);
    } else {
        $("#chips").append(chip);
    }
    $(".suppress").click(PL.suppressChip);
    PL.zoomChips();
    PL.carouselChanged();
        
    // Fetch the chip images after a delay
    function linkChipImages() {
        var i = PL.chips.queue.shift();
        if (!i) return;
        var url = PL.chips.urls[i]
        if (PL.chipStyle=='TC') url = url.replace('NL', 'TC');        
        
        $("#chips .chip[value="+i+"] img" ).css('background-image', 'url('+url+')');

        if (PL.chips.queue.length > 0) {
            setTimeout(linkChipImages, PL.delay());
        }
    }
    
    // Add chip to queue
    PL.chips.queue.push(idx);
    
    // Start processing queue if it's the only one
    if (PL.chips.queue.length == 1) {
        setTimeout(linkChipImages, PL.delay());
    }
    
    // Return true if the chip is within range
    return idx > -1 && idx < PL.chips.urls.length;
}

// Find the first non-filtered chip before or after the index provided, 
// or before the first or after the last chip currently in the carousel
PL.findNearbyChip = function(where, idx) {
    if(where=='start') {
        var start = idx ? idx : parseInt($("#chips .chip:first").attr('value'))-1;
        for(var i=start; i>=-1; i--) {
            if(PL.checkChip(i)) break;
        }
    } else {
        var start = idx ? idx : parseInt($("#chips .chip:last").attr('value'))+1;
        for(var i=start; i<PL.chips.timestamps.length; i++) {
            if(PL.checkChip(i)) break;
        }
    }
    return  i ? i : -1 
}

// Build a chip for the given index
PL.makeChip = function(idx) {
    if ((idx>=0) && (idx < PL.chips.urls.length)) {
        // Build the chip.
        // A chip is a <figure> containing an empty image <img> with a
        // background-image (so it can scale), an overlaid SVG, and a timestamp
        var date = new Date(PL.chips.timestamps[idx]);
        
        var chip = '<figure class="chip" value="'+ idx +'">'+
            '<img class="pixelated" />'+
                '<span class="suppress">X</span>'+
                PL.chips.patchSVG +
            '<figcaption>'+date.toDateString()+'</figcaption>'+
            '</figure>';
    } else {
        // Empty chip. Used as placeholders for the 2 buffered
        // chips when at the beginning or end of the carousel.
        var chip = '<figure class="chip" value="'+ idx +'"></figure>';
    }
    
    return chip;
}

// Load a chip at the end of the carousel
PL.showNextChip = function() {
    if($("#carousel_next").hasClass('disabled'))
        return;;

    $("#chips .chip:first").remove()
    PL.addChip('end');
}

// Load a chip at the beginning of the carousel
PL.showPrevChip = function() {
    if($("#carousel_prev").hasClass('disabled'))
        return;

    $("#chips .chip:last").remove();
    PL.addChip('start');
}

// Repopulate the carousel so that it's centered on a target date
PL.carouselGoToDate = function(targetDate) {
    // If chips are loading form a previous selection, clear the queue.
    PL.chips.queue = [];
    $("#chips").html('');
    
    // Find the idx nearest to the requested date
    for(var idx=0; idx<PL.chips.timestamps.length; idx++) {
        if (PL.chips.timestamps[idx] >= targetDate) break;
    }
    
    // Add chips near the selected idx
    var where = 'start'
    PL.addChip(where, idx);
    for (var count=1; count<8; count++) {
        // Add the chip
        var result = PL.addChip(where);
        if(result == false) {
            // Empty chip added, add next ones to the other end.
             where = (where=='start') ? 'end' : 'start';
        } 
        
        // Half-way, attempt to switch ends.  This also ensures one (possibly empty) chip is at the end.
        if(count == 4) where = 'end';
    }
    
    $("#chips .chip").toggleClass('selected_chip', false);
    $("#chips .chip[value="+idx+"]").toggleClass('selected_chip');
    
}

//Calculate a delay so that we don't hammer the ee server
PL.delay = function() {
    if(!PL.eeBufferRegenerate_ticker) {
        PL.eeBufferRegenerate_ticker = setInterval(PL.eeBufferRegenerate, 1000);
    }
    PL.eeRequestBuffer = Math.max(0, PL.eeRequestBuffer-1);
    return Math.round(2000/(1+PL.eeRequestBuffer));
}
// Regenerate the delay buffer
PL.eeBufferRegenerate = function() {
    PL.eeRequestBuffer += 1;
    if(PL.eeRequestBuffer >= 20) {
        PL.eeRequestBuffer = 20;
        clearInterval(PL.eeBufferRegenerate_ticker);
        PL.eeBufferRegenerate_ticker = null;
    }
}

// Check to see if a given chip is filtered out
PL.checkChip = function(i){
    var month = (new Date(PL.chips.timestamps[i])).getMonth();
    var month_filter = $("#monthfilter span").eq(month).attr('value') == 1;
    return (!PL.chips.suppressed[i]) && month_filter;
}

// Add chip to a ban-list and remove it from the carousel
PL.suppressChip = function() {
    var idx = $(this).parent().attr('value');
    PL.chips.suppressed[idx] = true;
    var chip = $("#chips .chip[value="+idx+"]");
    
    var delay = $(chip).css('transition-duration');
    $("#message").html(delay);
    if(delay.substr(-1) == 's' && delay.substr(-2) != 'ms'){
        delay = parseFloat(delay)*1000;
    } else {
        delay = parseFloat(delay);
    }
    
    $(chip).css('width', 0).css('margin',0).css('opacity', 0);
    setTimeout(function() { $(chip).remove(); PL.addChip('end');}, delay-50);
}

//Update the carousel and timeseries chart when month filters change
PL.updateMonthFilters = function() {
    $("#vegindex .tab[value="+PL.currentVI+"]").click();
    
    var idx = $("#chips .chip:eq(4)").attr('value');
    PL.carouselGoToDate(PL.chips.timestamps[idx]);
}


// Update some UI cues when the carousel changes
PL.carouselChanged = function() {
    //Update Disabled status of prev and next buttons
    $("#carousel .prev").toggleClass('disabled', parseInt($("#chips .chip:eq(1)").attr('value'))>=0 ? false : true);
    $("#carousel .next").toggleClass('disabled', parseInt($("#chips .chip:eq(7)").attr('value'))>PL.chips.timestamps.length);
    
    //Update position of the timeseries overlay showing carousel chips
    var cli = PL.timeseriesChart.getChartLayoutInterface();
    var left = cli.getXLocation(new Date(PL.chips.timestamps[$("#chips .chip:eq(2)").attr('value')]));
    var right = cli.getXLocation(new Date(PL.chips.timestamps[$("#chips .chip:eq(5)").attr('value')]));
     
    $("#chart_marker").css('left', left-5+'px');
    $("#chart_marker").css('width', (10+right-left)+'px');  
}

// Set the zoom level
PL.zoomChips = function() {
    PL.zoomLevel = $("#zoom").val();
    $("#carousel .chip img").css('background-size', PL.zoomLevel*50+'%');
    $("#carousel .chip .patch_outline").css('transform', 'scale('+PL.zoomLevel/2+')');
    $("#carousel .chip .patch_outline *").css('stroke-width', 1/(1+PL.zoomLevel/2) +'%');
    $("#zoom_level").text(PL.zoomLevel);
}


/*
    Functions for custom UI widgets
*/ 

// Toggle button select / deselect
PL.updateToggleButton = function() {
    $(this).toggleClass('toggle_button_selected');
    
    var name = $(this).attr('id');
    var val = $(this).hasClass('toggle_button_selected');
    $(this).attr('value', val ? 1 : 0);
}

// High-Medium-Low certainty selection
PL.HMLclick = function(obj){
    var name = $(this).parent().attr('id');
    var val = $(this).attr('value');
    
    PL.setHML(name, val);
}

// Set the HML value and styles
PL.setHML = function(name, val) {
    //Unset everything
    $("#"+name+" .hml_select_box").toggleClass("hml_low hml_medium hml_high", false);
    
    if(val){
        val = val.toLowerCase();
        var change_to = "hml_"+val;
        
        $("#"+name+" .hml_select_box[value=low]").toggleClass(change_to, true);
        if(val!='low')
            $("#"+name+" .hml_select_box[value=medium]").toggleClass(change_to, true);
        if(val=='high')
            $("#"+name+" .hml_select_box[value=high]").toggleClass(change_to, true);
    }
    
    $("#"+name).attr('value', val);
}

// Set a <select> based on the <option>'s text instead of value
PL.setSelect = function(name, val) {
    $("#"+name+" option").filter(function() {
            return ($(this).text() == val);
        }).prop('selected',true);
}


/*
    Timeseries Chart, based on google charts
*/


// Get new veg index data from EE and remake the chart
PL.changeTimeseries = function() {
    PL.currentVI = $(this).attr('value').toLowerCase();
    $("#vegindex .tab_selected").toggleClass('tab_selected', false)
    $(this).toggleClass('tab_selected');
    
    if (!PL.chips.patch) {
        $("#message").html(PL.currentVI + ' selected.');
        return;
    }
    $("#message").html('Loading '+PL.currentVI);
    
    $.ajax({
        url: "/lt-chipdata/data",
        data:{
            patch: PL.chips.patch,
            q: 'date,'+PL.currentVI
            },
        dataType: 'json',
        success: function(R) {
                PL.chartTimeseries(R['date'], R[PL.currentVI]);
                $("#message").html(PL.currentVI + ' loaded.');
            },
        error: function(obj, msg, st) {
                $("#message").html('Could not get vegetation index data!');
            }
    });
}

// Build the chart and display it
PL.chartTimeseries = function(date, vi) {
    var data = new google.visualization.DataTable();
    data.addColumn({type:'date', label:'Date', formatType:'medium'});
    data.addColumn({type:'number', label:''});
    data.addColumn({type:'number', label:PL.currentVI.toUpperCase()});
    data.addColumn({type:'number', label:"Disturbance Year"});
    
    for(var i=0; i<date.length; i++) {
        if(PL.checkChip(i)) {
            data.addRow([new Date(date[i]), null, vi[i], null]);
        } else {
            data.addRow([new Date(date[i]), vi[i], null, null]);
        }
    }

    var bounds = PL.calcBounds(vi)
    var vi_stretch = {min: Math.min(bounds.min, PL.VIStretch[PL.currentVI].min),
                      max: Math.max(bounds.max, PL.VIStretch[PL.currentVI].max)};
    
    var dYear = new Date(PL.chips.disturbanceYear+"-06-01");
    data.addRow([dYear, null, null, vi_stretch.min]);
    data.addRow([dYear, null, null, vi_stretch.max]);
 
    var options = {
        hAxis: {
            gridlines: {color:"#ddd"},
            viewWindow: {
                min: new Date("1984-06-01"),
                max: new Date()
                }
            },
        vAxis: {
            gridlines: {color:"#ddd"},
            viewWindow: vi_stretch
        },
        dataOpacity: 0.5,
        series: {
            0: {color:'#ccc'}, // filtered out by the months
            1: {color:'#06f'},
            2: {color:'#f00', lineWidth:1, lineDashStyle:[4,4], pointsVisible:false, pointSize:0}
        },
        chartArea: {left:'9%', top:'2%', width:'90%', height:'90%'},
        legend: {position: 'none'}
    };
    
    PL.timeseriesChart = new google.visualization.ScatterChart($("#timeseries_chart").get(0));
    PL.timeseriesChart.draw(data, options);
    google.visualization.events.addListener(PL.timeseriesChart, 'select', PL.timeseriesSelectPoint);
}

// Have the carousel go to the date clicked on in the timeseries
PL.timeseriesSelectPoint = function() {
    var selected = PL.timeseriesChart.getSelection()[0].row;
    var dateval = PL.chips.timestamps[selected];
    PL.carouselGoToDate(dateval);
}

// A helper function for calculating min and max in the veg index data
PL.calcBounds = function(x) {
    var B = {min:Infinity, max:-Infinity};
    for(var i=0; i<x.length; i++) {
        B.min = x[i] < B.min ? x[i] : B.min;
        B.max = x[i] > B.max ? x[i] : B.max;
    }
    return B;
}

// These define a minimum stretch; if the data exceeds these, 
// the min / max values of the data are used instead.    
PL.VIStretch = {
    nbr:   {min:0.01, max: 0.9},
    ndvi:  {min:0.01, max: 0.9},
    ndmi:  {min:0.01, max: 0.6},
    b5:    {min:0.01, max: 0.4},
    angle: {min:0.01, max: 45},
    bright:{min:0.01, max: 0.7},
    green: {min:-0.05, max: 0.3},
    wet:   {min:-0.2, max: 0.1}
};


/*
    Drop-down box lookup arrays
*/

PL.LandUseTypes = [
    "",
    "Forest",
    "Natural non-forest vegetation",
    "Non-vegetated natural",
    "Agriculture",
    "Urban",
    "Non-vegetated anthropogenic"
];

PL.LandCoverTypes = [
    "",
    "Conifer",
    "Broadleaf",
    "Shrubs",
    "Herbaceous",
    "Impervious",
    "Barren",
    "Water",
    "Snow/Ice"
];

PL.ChangeProcesses = [
    "",
    "Clearcut",
    "Partial Harvest",
    "Development",
    "Fire",
    "Salvage",
    "Insect/Disease",
    "Road",
    "No Visible Change",
    "False Change",
    "Unknown Agent",
    "Water",
    "Wind",
    "Avalanche: chute",
    "Avalanche: runout",
    "Debris flow",
    "Landslide",
    "Other"
];
