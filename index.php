<?php include('actions/login.php'); ?>
<!DOCTYPE html>
<html>
<head>
    <title>LandTrendr Labeling</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
    <link rel="stylesheet" href="includes/screen.css">
    <script src="https://www.google.com/jsapi"></script>
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js"></script>
    <script src="includes/patchlabel.js"></script>
</head>



<body>

<div id="land-label">

    <div id="header">
        <a href="https://earthengine.google.org" id="google">
            <img class="powered-by-ee" alt="Powered by Google Earth Engine" src="includes/google_earthengine_powered_400px.png" height="50">
        </a>
       
        <h1>LandTrendr Labeling</h1>
        <div id="user_panel">
            
            <h3 id="username">
                <?="$_SESSION[user_fullname] ($_SESSION[user_id]: $_SESSION[user_name])"?>
                <a href="actions/signout.php" id="signout">Sign Out</a>
            </h3>
            <input type="hidden" id="user_id" value="<?=$_SESSION[user_id]?>" />
        </div>
    </div>
    
    <div id="message"></div>
    
    <div id="task_panel">
        <div id="projects_panel" >
            <select id="project_id"></select>
        </div>
        <div id="kml_download">
            
        </div>
        <div id="plots_panel">
            <div id="plot_list"></div>
            <input type="hidden" id="plot_id" />
        </div>
    </div>    

    <div id="timeseries_panel">
        <div id="vegindex">
            <span class="tab tab_selected" value="nbr">NBR</span>
            <span class="tab" value="ndvi">NDVI</span>
            <span class="tab" value="ndmi">NDMI</span>
            <span class="tab" value="angle">ANGLE</span>
            <span class="tab" value="b5">B5</span>
            <span class="tab" value="wet">Wetness</span>
        </div>
        <div id="timeseries">
            <div id="timeseries_chart"></div>
            <div id="chart_marker"></div>
        </div>
    </div>
        
    <div id="label_panel">
    
        <fieldset id="change"><legend>Change Process</legend>
            <label><span class="desc">Best Guess:</span>
                <select id="changeprocess" class="change"></select>
                <span class="hml_select" id="changeprocess_certainty"></span>
            </label>
            
            <label><span class="desc">Might be:</span>
                <select id="changeprocess_possible" class="change"></select>
            </label>
            
            <div id="change_certainty" style="position:relative;">
                <label class="certainty_criterion">Shape: <span class="hml_select" id="shape"></span></label>
                <label class="certainty_criterion">Context: <span class="hml_select" id="context"></span></label>
                <label class="certainty_criterion">Trajectory: <span class="hml_select" id="trajectory"></span></label>
            </div>
            
            <div id="change_tags">
                <span class="toggle_button" id="isphenology">phenology</span>
                <span class="toggle_button" id="iscloud">cloud</span>
                <span class="toggle_button" id="ismisregistration">misregistration</span>
                <span class="toggle_button" id="ispartialpatch">partial patch</span>
                <span class="toggle_button" id="issnow">snow</span>
                <span class="toggle_button" id="iswrongyear">wrong year</span>
            </div>
            
            <label>Notes:
            <textarea id="comments"></textarea>
            </label>
        </fieldset>
        
        <fieldset id="land_before"><legend>Before</legend>
            <fieldset><legend>Primary</legend>
                <div class="anchor"><label class="dominant"><span class="toggle_button" id="dominant_before">dominant</span></label></div>
 
                <label><span class="desc">Land Use:</span>
                    <select id="landuse_before_primary" class="landuse"></select>
                    <span class="hml_select" id="landuse_before_primary_certainty"></span>
                </label>
       
                <label><span class="desc">Land Cover:</span>
                    <select id="landcover_before_primary" class="landcover"></select>
                    <span class="hml_select" id="landcover_before_primary_certainty"></span>
                </label>
            </fieldset>
            
            <fieldset><legend>Secondary</legend>
                <label><span class="desc">Land Use:</span>
                    <select id="landuse_before_secondary" class="landuse"></select>
                    <span class="hml_select" id="landuse_before_secondary_certainty"></span>
                </label>
       
                <label><span class="desc">Land Cover:</span>
                    <select id="landcover_before_secondary" class="landcover"></select>
                    <span class="hml_select" id="landcover_before_secondary_certainty"></span>
                </label>
            </fieldset>
        </fieldset>
        
        <fieldset id="land_after"><legend>After</legend>
            <fieldset><legend>Primary</legend>
                <div class="anchor"><label class="dominant"><span class="toggle_button" id="dominant_after">dominant</span></label></div>
                
                <label><span class="desc">Land Use:</span>
                    <select id="landuse_after_primary" class="landuse"></select>
                    <span class="hml_select" id="landuse_after_primary_certainty"></span>
                </label>

                <label><span class="desc">Land Cover:</span>
                    <select id="landcover_after_primary" class="landcover"></select>
                    <span class="hml_select" id="landcover_after_primary_certainty"></span>
                </label>
            </fieldset>
            
            <fieldset><legend>Secondary</legend>
                <label><span class="desc">Land Use:</span>
                    <select id="landuse_after_secondary" class="landuse"></select>
                    <span class="hml_select" id="landuse_after_secondary_certainty"></span>
                </label>

                <label><span class="desc">Land Cover:</span>
                    <select id="landcover_after_secondary" class="landcover"></select>
                    <span class="hml_select" id="landcover_after_secondary_certainty"></span>
                </label>
            </fieldset>
        </fieldset>
        
    </div>
        
    <div id="chip_panel">
        <div id="chipstyle">
            <span class="tab tab_selected" value="NL">Natural Look</span>
            <span class="tab" value="TC">Tassel Cap</span>
        </div>        
        <label><span>Zoom:</span> <span id="zoom_level">2</span>x <input id="zoom" type="range" min="2" max="12" value="2" /></label>
        <div id="monthfilter">
            <span class="toggle_button" value="0">Jan</span>
            <span class="toggle_button" value="0">Feb</span>
            <span class="toggle_button" value="0">Mar</span>
            <span class="toggle_button" value="0">Apr</span>
            <span class="toggle_button" value="1">May</span>
            <span class="toggle_button" value="1">Jun</span>
            <span class="toggle_button" value="1">Jul</span>
            <span class="toggle_button" value="1">Aug</span>
            <span class="toggle_button" value="0">Sep</span>
            <span class="toggle_button" value="0">Oct</span>
            <span class="toggle_button" value="0">Nov</span>
            <span class="toggle_button" value="0">Dec</span>
        </div>
        <div id="carousel">
            <span id="carousel_prev" class="prev disabled">&#9664;</span>
            <div id="chips"></div>
            <span id="carousel_next" class="next disabled">&#9654;</span>
        </div>
    </div>
    
</div>


<!-- Boot our JavaScript once the body has loaded. -->
<script>
    PL.boot();
</script>

</body>
</html>
