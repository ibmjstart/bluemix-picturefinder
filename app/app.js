/* Copyright IBM Corp. 2014 All Rights Reserved                      */
/* jslint node:true*/

var http = require('http');
var path = require('path');
var express = require('express');
var rest = require('node-rest-client');
var hogan = require('hogan-express');
var mysql = require('mysql');
var fs = require('fs');
var instagram = require('instagram-node-lib');
var moment = require('moment');
var pinch = require('pinch');

instagram.set('client_id', 'yourInstagramID');
instagram.set('client_secret', 'yourInstagramSecret');


// required to make an https/tls connection to pb
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var port = (process.env.VCAP_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');
//for running locally
var appId = "yourPBAppID";
var appSecret = "yourPBSecret";
var url = "https://pitneybowes.pbondemand.com/location/address/geocode.json";

// all environments
var app = express();

// check if application is being run in cloud environment
if (process.env.VCAP_SERVICES) {
  var services = JSON.parse(process.env.VCAP_SERVICES);

  // look for a service starting with 'user-provided'
  for (var svcName in services) {
    if (svcName.match(/user-provided/)) {
      var geoCreds = services[svcName][0]['credentials'];
	  appId = geoCreds.appId;
      url = geoCreds.url;	
	  console.log("In vcap check, appId is " + appId);
	  console.log("In vcap check, url is " + url);	
		
  	} // end if user-provided
	} // end for
} // end if vcap

app.set('port', port);
app.set('views', __dirname + '/views');
app.set('view engine', 'html');
app.set('env', 'development');
app.engine('html', hogan);

app.use(express.favicon(path.join(__dirname, 'public/images/favicon.ico')));
app.use(express.logger());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// show table
app.all('/', function (req, res) {

    res.render('index.html');
});

// post location
app.post('/location', function (req, res) {
	
	var address = req.body.address;
	var city = req.body.city;
	var state = req.body.state;
	
	var Client = rest.Client;
	client = new Client();
	
	if (!address && !city && !state)
		res.render('index.html');

	// direct way
	client.get(url + "?address=" + address + "&city=" + city + "&stateProvince=" + state + "&country=USA&fallbackToPostal=Y&fallbackToStreet=Y&fallbackToGeographic=Y&closeMatchesOnly=Y&appId=" + appId, function(data, response){
	            // data in callback contains the json returned from pitney bowes
						
			   if (data.httpCode != "500")
			   {
				   lat = data.Output.Geometry.Pos.Y;
				   lng = data.Output.Geometry.Pos.X;
				
			   	instagram.media.search({
				  lat: lat,
				  lng: lng,
				  complete: function(data){
					// pinch converts all unix timestamps to a friendly date
					pinch(data, /created_time/, function(path, key, value) {
					  return moment(value*1000).format("MMMM Do YYYY, h:mm a");
					});				

				    res.render('index.html', {data: data, address: address, city: city, state: state});	   

				  }, // end complete
				});// end search
			   }// end httpCode check
			   else
			   {
				  msg = "Can't find any pictures near this address";
				  res.render('index.html', {msg: msg, address: address, city: city, state: state});
			   } 
	

		     }); // end PB call
}); // end post route



// start server
http.createServer(app).listen(app.get('port'), function () {
  console.log('Express server listening at http://' + host + ':' + port);
});

// unused code follows

function isNotEmpty(str) {
  return str && str.trim().length > 0;
}
