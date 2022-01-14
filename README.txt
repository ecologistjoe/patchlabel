PatchLabel allows a human interpreter to provide constrained descriptions of a defined plot using a web interface while looking at data from Google Earth Engine.

Plots are grouped by Project and by 'TSA' -- essentially WRS2 path/row. The TSA part is a legacy of old systems Robert, Warren, and Yang set up years ago -- essentially our patch ids are only unique to the path/row level, so we keep them around.

Descriptions of plots are kept in a MySQL database. The plot boundaries are kept in kml and json files that are referenced by the project / tsa / plot_id.  The json is read by the web app, and the KML can be downloaded and opened in desktop Google Earth so that interpreters have access to historical photos too.  Also in the database are some administrative tables for users and their interpretation assignments.  I've included some examples of these, but they typically live outside of the web-accessible directories.

All of the database access and manipulation is done using PHP; those files are in the ./actions directory.  The database schema along with some sample data is in database.sql.

All of the imagery and remote sensing data is manipulated using the Google Earth Engine Python API.  There's only one webapp script for that, landsat_chips.py in the ./chipdata directory. It handles two different requests, one for data (scene lists and veg indices) and one that grabs images.  You'll need to set up a GEE authentication token in config.py and privatekey.pem.  You'll also need to specify some directory names where the data gets cached.

The first time that a plot is requested, the script requests from EE timeseries of a number of vegetation indices.  It gets one datapoint per Landsat scene (with some filtering for clouds), with the veg index averaged over the patch.  This can take several seconds to a minute, so there's an annoying delay -- this can be fixed by pre-fetching those datasets when you make a new project, but be mindful of Earth Engine's limiting to 3 requests per second.

For Python webapps to work, they need to be set up in Apache using WSGI. You'll just need to include an addition to the config files in httpd.conf, I've included an example in virtualhosts.conf.  

Interaction with the web interface is handed by patchlabel.js in the ./includes directory.  It basically just sends requests to the PHP scripts or to the Python API. The javascript also has the code for the chip carousel and the chart.









