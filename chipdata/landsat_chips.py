import os, sys
# Add this directory to the import path
sys.path.insert(0, os.path.dirname(__file__))

import config
import ee
import json
import webapp2
import requests

# Sign in to Earth Engine using the service account creditials found in config.py
ee.Initialize(ee.ServiceAccountCredentials(config.EE_ACCOUNT, config.EE_PRIVATE_KEY_FILE))

# Some constants
CACHE_BASE = '/home/chipcache/';    # the physical location of the local cache
URL_BASE = '/lt-chipdata';          # where this webapp is mounted / virtual hosted
CHIP_SIZE = 150;                    # pixels
LOCATION_HASH_SCALE = 10000         # lat/lon decimal precision
DEFAULT_PATCH_RADIUS = 150          # pixels

# WebApp2 servlet to handle requests for timeseries over the patch data
class DataHandler(webapp2.RequestHandler):
    def get(self, path=''):
        
        # params keep both GET and POST values
        GET = self.request.params
        
        #Parse the patch polygon/point, and get the patch and its cetner
        center, patch = getLocation(GET)
        
        # Read data from cache or get it from EE
        data = getData(center, patch)
        
        # Return only the requested fields
        fields = GET['q'].split(',') if ('q' in GET) else 'chips'
        selected = {x:data[x] for x in fields if x in data}
        self.response.write(json.dumps(selected))
    
    # Do same thing on GET and POST methods
    def post(self, path=''):
        self.get(path)        

# WebApp2 servlet to handle requests for image chips
class ChipHandler(webapp2.RequestHandler):
    # The chip fields get parsed in the URL
    def get(self, style, image_name, plot_hash, ext='png'):

        GET = self.request.params
        filename = CACHE_BASE + os.path.basename(self.request.path)
        
        #Check if there's a local version of the chip
        if not os.path.isfile(filename):
            # Chip not in local cache, request it from EE
            chip = downloadChip(image_name, plot_hash, style)
            self.response.set_status(chip.status_code)
            # Write chip to local cache if it was read successfully
            if chip.status_code == 200:
                with open(filename, 'w+') as outfile:
                    outfile.write(chip.content)
            chip = chip.content
        else:
            # Read local version
            with open(filename, 'r') as infile:
                chip = infile.read()

        # Respond with the chip data
        self.response.headers['Content-Type'] = "image/png"
        self.response.headers['Cache-Control'] = "public, max-age=86400"
        self.response.write(chip)
        
# Initialize the webapp handlers.
application = webapp2.WSGIApplication([
    (URL_BASE+'/data', DataHandler),
    (URL_BASE+'/(TC|NL)_(L.+?)_(.+?)\.(png|zip)', ChipHandler)
], debug=True)


# Read the data from either the cache or get it from EE 
def getData(center, patch):
    # Use the plot center location to make a unique ID for the plot
    plot_location_hash = "{0}_{1}".format(*[int(x*LOCATION_HASH_SCALE) for x in center])
    data_file = CACHE_BASE + 'data_' + plot_location_hash + '.json'
    
    if os.path.isfile(data_file):
        # Read data from cache
        with open(data_file, 'r') as infile:
            data = json.load(infile)
    else:
        # Get data from EE
        data = downloadData(center, patch)     
        with open(data_file, 'w') as outfile:
            json.dump(data, outfile, sort_keys=True, indent=2)
    
    # Don't save chip URLS; build them on the fly
    data['chips'] = [URL_BASE + '/NL_' + x + '_' + plot_location_hash + '.png' for x in data['id']]

    return data
    

# Parse the patch object in a data request
def getLocation(GET):
    patch = json.loads(GET['patch'])
    if isinstance(patch[0],(list,tuple)):
        # Should be proper JSON polygon object
        center = getPatchCenter(patch)
        patch = ee.Geometry.Polygon(patch)
    else:
        # Assume Patch is Point
        center = patch
        patch =  ee.Geometry.Point(center[0], center[1]).buffer(DEFAULT_PATCH_RADIUS).bounds()
    
    return center, patch
    
 
# Determine the bounds of the patch and then find its non-weighted center
def getPatchCenter(patch):
    #Check if patch is multi-polygon.
    #If so, concatenate into a single list of points
    if isinstance(patch[0][0], (list, tuple)):
        patch = [inner for outer in patch for inner in outer]
    
    xs = [p[0] for p in patch]
    x = (max(xs) + min(xs)) / 2
    
    ys = [p[1] for p in patch]
    y = (max(ys) + min(ys)) /2
    
    return (x,y)
   
   
# Ask Earth Engine for the requested chip
def downloadChip(image_name, plot_hash, style):

    # build the EE chip identifier
    id = 'LANDSAT/' + image_name[0:3] + '_SR/' + image_name;
    img = ee.Image(id)

    # Get the chip bounds that was saved when the plot's data was requested. This is probably not ideal.
    data_file = CACHE_BASE + 'data_' + plot_hash + '.json'
    if os.path.isfile(data_file):
        with open(data_file, 'r') as infile:
            data = json.load(infile)
        chip_bounds = data['chip_bounds']
    
    # If L8 image, shift band numbers
    if (image_name[0:3] == 'LC8'):
        img = convertL8Bands(img)
        
    # Two styles are supported Tassel Cap (TC) and Natural Look (NL)
    if style == 'TC':
        img = TasselCap(img)
        min = '0.05,-0.1, -0.2'
        max = '0.55,0.2,0.1'
    else:
        img = img.select(['B5', 'B4', 'B3'])
        min = '0,0,0'
        max = '10000,10000,10000'
        
    # Ask EE for the URL
    url = img.getThumbURL({'dimensions':[CHIP_SIZE,CHIP_SIZE], 'region':chip_bounds, 'min':min, 'max':max, 'format':'png'})

    # Download the image
    return requests.get(url)
    

# Request within-patch means of several vegetation indices from
# Earth Engine for all high-quality Landsat images
def downloadData(center, patch): 

    # Get data from L4 through 8
    collections = ['LANDSAT/LT4_SR', 'LANDSAT/LT5_SR', 'LANDSAT/LE7_SR', 'LANDSAT/LC8_SR']
    
    center_point = ee.Geometry.Point(center[0], center[1]);
    features = []
    for collection in collections:
        # Request all images in the collection at the specified point with USGS cloud_cover < 40
        images = ee.ImageCollection(collection).filterBounds(center_point)
            #.filterMetadata('CLOUD_COVER', 'less_than', 40)\
            #.filter(ee.Filter.calendarRange(6, 9, 'month'))\
            #.sort('system:time_start')
                
        # Finds within-patch means of VIs for an image
        # This function will be mapped over the collection
        def calcIndices(img):
            # Make cloud score
            #cloud = ee.Algorithms.Landsat.simpleCloudScore(img).select(['cloud']).divide(ee.Image(100))
            #cloud_score = cloud.reduceRegion(ee.Reducer.mean(), patch, 30).get('cloud')
            
            mask = img.select('B5').mask()
            img = img.unmask()
            mask = mask.multiply(img.select(['cfmask']).eq(ee.Image(0)))
            img = img.updateMask(mask)
            
            score = mask.reduceRegion(ee.Reducer.mean(), patch, 30).get('B5')
            
            # If L8, shift band numbers
            if collection == 'LANDSAT/LC8_SR':
                img = convertL8Bands(img)

            # Define VIs
            indices = ee.Image.cat(
                img.normalizedDifference(['B4', 'B3']).select(['nd'],['ndvi']),
                img.normalizedDifference(['B4', 'B5']).select(['nd'],['ndmi']),
                img.normalizedDifference(['B4', 'B7']).select(['nd'],['nbr']),
                img.select(['B5'],['b5']).divide(ee.Image(10000)),
                TasselCap(img))
            indices = indices.addBands(indices.select('bright').atan2(indices.select('green')).select(['bright'],['angle']))
            indices = indices.select(['ndvi', 'ndmi', 'nbr', 'b5', 'wet', 'angle'])
            
            # Update the mask to the cloud-cover score for weighted averaging
            #indices = indices.updateMask(ee.Image(1.001).subtract(cloud))
            
            # Average over patch
            reducer = ee.Reducer.mean().forEachBand(indices)
            data = indices.reduceRegion(reducer, patch, 30)
            
            # Add some metadata
            data = data.combine({
                'score':score,
                'date':img.get('system:time_start'),
                'id':img.get('system:index')})
            
            # Only return data if the cloud_score exists (is not NaN) and is < 0.4
            #data =  ee.Algorithms.If(cloud_score, 
            #        ee.Algorithms.If(ee.Number(cloud_score).lt(0.4),
            #            ee.Feature(None, data),
            #            ee.Feature(None, None)), ee.Feature(None, None))
            
            data = ee.Algorithms.If(score,
                   ee.Algorithms.If(ee.Number(score).gt(0.6),
                       ee.Feature(None, data),
                       ee.Feature(None, None)), ee.Feature(None,None));
            return data
        
        # combine features from all images in all collections
        features += images.map(calcIndices, True).filter(ee.Filter.gt('score',0.6)).getInfo()['features']
        
        
    # Request the feature data from Earth Engine
    
    # Write a temp file for debugging
    with open('/home/chipcache/temp.txt', 'w') as outfile:
        outfile.write(json.dumps(features,indent=4))

    # Invert array of dictionaries into a dictionary of parallel arrays, sorted by date
    features = [x['properties'] for x in features if x['properties']]
    features = sorted(features, key=lambda x: x['date'])
    features  = {key:[round(x[key],4) if isinstance(x[key], float) else x[key] for x in features] for key in features[0].keys() }

    #Convert ANGLE to degrees; 57.3 = 180/pi
    features['angle'] = [57.3*x for x in features['angle']]
    
    # Add the chip bounds to avoid additional EE getInfo() calls for each chip
    # (computed values don't work with getThumbURL() )
    features['chip_bounds'] = center_point.buffer(CHIP_SIZE/2*30).bounds().getInfo()

    return features
    
    
# Shift bands in L8 images down for code re-use between sensors
def convertL8Bands(img):
    return img.select(['B2', 'B3', 'B4', 'B5', 'B6', 'B7'], ['B1', 'B2', 'B3', 'B4', 'B5', 'B7'])
   
# Calculate the Tassel Cap transform of an image
def TasselCap(img):
    img = img.select('B1', 'B2', 'B3', 'B4', 'B5', 'B7').divide(ee.Image(10000))
    TCB = ee.Image([ 0.2909,  0.2493,  0.4806,  0.5568,  0.4438,  0.1706])
    TCG = ee.Image([-0.2728, -0.2174, -0.5508,  0.7221,  0.0733, -0.1648])
    TCW = ee.Image([ 0.1446,  0.1761,  0.3322,  0.3396, -0.6210, -0.4186])
    TCB = TCB.select(TCB.bandNames(), ['B1', 'B2', 'B3', 'B4', 'B5', 'B7'])
    TCG = TCG.select(TCG.bandNames(), ['B1', 'B2', 'B3', 'B4', 'B5', 'B7'])
    TCW = TCW.select(TCW.bandNames(), ['B1', 'B2', 'B3', 'B4', 'B5', 'B7'])
    TC = ee.Image.cat(img.multiply(TCB).reduce(ee.Reducer.sum()),
                      img.multiply(TCG).reduce(ee.Reducer.sum()),
                      img.multiply(TCW).reduce(ee.Reducer.sum()))
    TC = TC.select(TC.bandNames(), ['bright', 'green', 'wet'])
    return TC
