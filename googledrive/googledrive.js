/* === This file is part of Tomahawk Player - <http://tomahawk-player.org> ===
 *
 *   Copyright 2013, Rémi Benoit <r3m1.benoit@gmail.com>
 *
 *   Tomahawk is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   Tomahawk is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with Tomahawk. If not, see <http://www.gnu.org/licenses/>.
 */

var GoogleDriveResolver = Tomahawk.extend(TomahawkResolver, {
	uid: '',
	cursor: '',
	maxResults: '150',
	getFileUrl: '',
	 
    settings: {
        name: 'Google Drive',
        weight: 60,
        icon : 'googledrive.png',
        timeout: 15
    },
    
    getConfigUi: function () {
        var uiData = Tomahawk.readBase64("config.ui");
        return {

            "widget": uiData,
            fields: [{
                name: "associateButton",
                widget: "associateButton",
				property: "text",
                connections : [ { 
                		  signal: "clicked()", 
                		  javascriptCallback: "resolver.associateClicked();" 
                		}]                
            },
            {
                name: "deleteButton",
                widget: "deleteButton",
                property: "text",
                connections : [ { 
                		  signal: "clicked()", 
                		  javascriptCallback: "resolver.deleteClicked();" 
                		}]                
            },],
            images: [{
                "googledrive.png": Tomahawk.readBase64("googledrive.png")
            }, ]
        };
    },
        
    newConfigSaved: function () {
    },
    
    associateClicked: function () {
       Tomahawk.log("Associate was clicked");
       this.oauth.associate(this.updateDatabase.bind(this));
    },
    
    deleteClicked: function () {
       Tomahawk.log("Delete was clicked");
       
       this.cursor = '';
	   dbLocal.setItem('googledrive.cursor','');
	   
       this.oauth.deleteAssociation();
       
    },
    
    queryFailure: function(data) {
    	Tomahawk.log("Request Failed : " + data.text);
    },
    
    init: function () {
        Tomahawk.log("Beginnning INIT of Google Drive resovler");   
		//dbLocal.setItem("googledrive.expiresOn","1");
		dbLocal.setItem("googledrive.cursor","");

        Tomahawk.addLocalJSFile("musicManager.js");
        
        this.cursor = dbLocal.getItem('googledrive.cursor','');
        
        this.oauth.init();
        
        Tomahawk.addCustomUrlHandler( "googledrive", "getStreamUrl" );
        Tomahawk.reportCapabilities( TomahawkResolverCapability.Browsable | TomahawkResolverCapability.AccountFactory );
        
        musicManager.initDatabase() ;        
        this.googleDriveMusicManagerTests() ; 
        
        Tomahawk.log((Math.floor(Date.now()/1000) ).toString());

		//TODO updateDatabase when?
  		this.updateDatabase();
    },
        
    updateDatabase: function(pageToken){
    	Tomahawk.log("Sending Delta Query : ");
    	pageToken = pageToken || (this.cursor === '' ? '1' : this.cursor);

    	var url = 'https://www.googleapis.com/drive/v2/changes?'
    			  +'maxResults=' + this.maxResults
    			  +'&pageToken=' + pageToken; 
		
	    Tomahawk.log("URL used : "+ url);
		this.oauth.ogetJSON(url, this.deltaCallback.bind(this));
    },
    
    deltaCallback: function(response){
    	//TODO set cursor in DB
    	Tomahawk.log("Delta returned!");
    	Tomahawk.log("nextPageToken : " + response.nextPageToken);
    	Tomahawk.log("largestChangeId : " + response.largestChangeId);
    	//Tomahawk.log(DumpObjectIndented(response));

    	
    	for( var i = 0; i < response.items.length; i++){
			var item = response.items[i];
			
			if(item['deleted']){
					Tomahawk.log("Deleting : " + item['fileId']);
					//dbSQL.deleteTrack(item.file.id);
			}else{		
				var file = item['file'];
				//Tomahawk.log("File : " + item['file']['title']+ " is supported : " + this.isMimeTypeSupported(item['file']['mimeType']));
				
				if(this.isMimeTypeSupported(file['mimeType'])){
						//Tomahawk.log(DumpObjectIndented(item));
						//Get ID3 Tag
						Tomahawk.log("Get ID3Tag from : " + file['originalFilename']);
						//Tomahawk.log("size : " + item['file']['fileSize']);
						//Tomahawk.log("mime : " + item['file']['mimeType']);
						//Tomahawk.log('url : ' + this.getStreamUrl(item['file']['id']));
						Tomahawk.ReadCloudFile(file['originalFilename'], file['fileSize'], file['mimeType'], this.getStreamUrl(file['id']), "onID3TagCallback"
																											);
				}
			}
		}
		if(response.nextPageToken){
			this.updateDatabase(response.nextPageToken);
		}else{
			this.cursor = parseInt(response.largestChangeId) + 1;
			dbLocal.setItem('googledrive.cursor', this.cursor);
		}
    },
  
    resolve: function (qid, artist, album, title) {
       musicManager.resolve(artist, album, title, function(results) {
		   var return_songs = {
                qid: qid,
                results: results
            };
            //Tomahawk.log("google drive resolved query returned: ");
            Tomahawk.addTrackResults(return_songs);
	   });
	   
    },

    search: function (qid, searchString) {
        // set up a limit for the musicManager search Query
        Tomahawk.log("search query");
		musicManager.searchQuery(searchString,function(results){
		   var return_songs = {
				qid: qid,
				results: results
			};
			Tomahawk.log("google drive search query returned: ");
			Tomahawk.addTrackResults(return_songs);
	   });
    },
    
    artists: function( qid )
    {
		Tomahawk.log("artists query");
		musicManager.allArtistsQuery(function(results){
			var return_artists = {
				qid: qid,
				artists: results
			};
            Tomahawk.log("google drive artists returned: ");
            //Tomahawk.addArtistResults(return_artists);
		});
    },

    albums: function( qid, artist )
    {
		Tomahawk.log("albums query");
		musicManager.albumsQuery(artist, function(results){
			var return_albums = {
                qid: qid,
                artist: artist,
                albums: results
            };
            Tomahawk.log("google drive albums returned: ");
            //Tomahawk.addAlbumResults(return_albums);
        });         
    },

    tracks: function( qid, artist, album )
    {
		Tomahawk.log("tracks query");
		musicManager.tracksQuery(artist, album, function(results){
			var return_tracks = {
                qid: qid,
                artist: artist,
                album: album,
                results: results
            };
            Tomahawk.log("Google Drive tracks returned:");
            //Tomahawk.addAlbumTrackResults(return_tracks);
		});
    },
    
    getStreamUrl: function (ourUrl) {
        var songId = ourUrl.replace("googledrive://", "");
		
		return(this.oauth.createOauthUrl('https://docs.google.com/uc?export=download&id=' + songId)) ;
        
    },
	
	googleDriveMusicManagerTests: function() {	 
		 musicManagerTester.flushDatabaseTest() ;
		 musicManagerTester.init() ;
		 //musicManagerTester.populateDatabase(9) ;
		 //musicManagerTester.searchQueryTest() ;
		 //~ musicManagerTester.resolveTest() ;
		 //~ musicManagerTester.allArtistsQueryTest() ;
		 //~ musicManagerTester.tracksQueryTest() ;
		 //~ musicManagerTester.albumsQueryTest() ;		 		 
		 //musicManagerTester.searchQueryTest() ;
		 //musicManagerTester.showDatabase() ;
	},

    onID3TagCallback: function(tags)
    {
		//Add track to database
		//var url = 'googledrive://' + fileId;
		//dbSql.addTrack
		Tomahawk.log("Tags : ");
		Tomahawk.log(DumpObjectIndented(tags));
		
	},
    
    //TODO: put that in QTScriptResolverHelper
    isMimeTypeSupported: function(mimeType)
    {
		//Tomahawk.log("Checking : "+ mimeType);
		var mimes =  [ "audio/mpeg" , "application/ogg" , "application/ogg" , "audio/x-musepack" , "audio/x-ms-wma" , "audio/mp4" , "audio/mp4" , "audio/mp4" , "audio/flac" , "audio/aiff" ,  "audio/aiff" , "audio/x-wavpack" ];
		return (mimes.lastIndexOf(mimeType) != -1);
	},
    
    oauth: {
    
    	init: function(){
    		this.accessToken = dbLocal.getItem('googledrive.accessToken','');
    		this.refreshToken = dbLocal.getItem('googledrive.refreshToken','');
    		this.expiresOn = dbLocal.getItem('googledrive.expiresOn','');
    	},
    
    	//associate a new User
    	//If the association is succesfull the previous token is discarded
    	associate: function(callback){
    		var url = this.oauthUrl + '?response_type=code' 
									 + '&client_id=' + this.clientId 
									 + '&redirect_uri=' + this.redirectUri 
									 + '&scope=' + this.scopes;
    		this.openAcceptPage(url, callback);						
    	},
    	
    	deleteAssociation: function(){
	 		dbLocal.setItem('googledrive.accessToken','');
			dbLocal.setItem('googledrive.refreshToken','');
			dbLocal.setItem('googledrive.expiresOn','');
			
			this.accessToken = '';
			this.refreshToken = '';
			this.expiresOn = '';
    	},
    	
    	isAssociated: function(){
    		var accessToken = dbLocal.getItem('googledrive.accessToken','');
    		var refreshToken = dbLocal.getItem('googledrive.refreshToken','');
    		return( !(accessToken === '') &&  !(refreshToken === '') );
    	},
    	
    	opostJSON: function(url, data, success){
			//var that = this;
    		if(!this.isAssociated()){
    			//TODO throw error NoAccountAssociated ?
    			Tomahawk.log("REFUSED Post to "+ url + " : No account associated");
			}else{
				if(this.tokenExpired()){
					Tomahawk.log("Token expired");
    				this.getRefreshedAccessToken(function (){this.opostJSON(url, data, success);}.bind(this));
				}else{
					//TODO treat case no parameters given
					Tomahawk.asyncPostRequest(url, data, function (data) {
													success(JSON.parse(data.responseText));
											   }, {'Authorization': 'Bearer '+ this.accessToken});
				}
			}
    	},
    	
    	ogetJSON: function(url, success){
			//var that = this;
    		if(!this.isAssociated()){
    			//TODO throw error NoAccountAssociated ?
    			Tomahawk.log("REFUSED Get to "+ url + " : No account associated");
			}else{
				if(this.tokenExpired()){
					Tomahawk.log("Token expired");
    				this.getRefreshedAccessToken(function (){this.ogetJSON(url, success);}.bind(this));
				}else{
					//TODO treat case no parameters given
					Tomahawk.asyncRequest(url, function (data) {
													success(JSON.parse(data.responseText));
											   }, {'Authorization': 'Bearer '+ this.accessToken});
				}
			}
    	},
    	
    	createOauthUrl: function(url){
			if(!this.isAssociated()){
    			//TODO throw error NoAccountAssociated ?
    			Tomahawk.log("REFUSED Creation to "+ url + " : No account associated");
			}else{
				if(this.tokenExpired()){
					Tomahawk.log("Token expired");
    				this.getRefreshedAccessToken(function (){this.createOauthUrl(url);}.bind(this));
				}else{
					return (url + '&access_token=' + this.accessToken);
				}
			}
		},
    	
    	//Private member
    	
       clientId: '440397511251.apps.googleusercontent.com',
       clientSecret: 'Y2ucuavLH6HN4CmlPGhdHuxu',
       oauthUrl:	'https://accounts.google.com/o/oauth2/auth',
       tokenUrl: 'https://accounts.google.com/o/oauth2/token',
       scopes: 'https://www.googleapis.com/auth/drive.readonly',
       redirectUri: 'urn:ietf:wg:oauth:2.0:oob',
       accessToken: '',
       refreshToken: '',
       expiresOn: '',

        
		openAcceptPage: function(url, callback) {
			Tomahawk.log('Opening : ' + url);
			Tomahawk.requestWebView("acceptPage", url);
	
			//acceptPage.setWindowModality(2);
			//acceptPage.resize(acceptPage.height(), 800);

			acceptPage.show();
			acceptPage.titleChanged.connect(Tomahawk.resolver.instance.oauth, function(title){
												 					  		  this.onTitleChanged(title, callback);
																		  });
		},
    	
	    onTitleChanged: function(title, callback){
			Tomahawk.log("Title changed : \'" + title+"\'"); 
			
			var result = title.split('=');
			
			if(result[0] === 'Success code'){
				Tomahawk.log("Accepted");
				var that = this;
				var params = 'grant_type=authorization_code'
						   + '&code=' + result[1] 
						   + '&client_id=' + this.clientId 
						   + '&client_secret='+ this.clientSecret 
						   + '&redirect_uri=' + this.redirectUri;

				Tomahawk.asyncPostRequest(this.tokenUrl, params, function(data){
																		this.onAccessTokenReceived(data, callback);
																 	}.bind(this));
			}
		
			if(result[0] === 'Denied error'){ 
				Tomahawk.log("Refused");
				//close webpage
			}
		},
	
		onAccessTokenReceived: function(data, callback){	
			//parse response
		    var ret = JSON.parse(data.responseText);
		
			//TODO close webpage

			this.accessToken = ret.access_token;
			this.refreshToken = ret.refresh_token;
			this.expiresOn = Math.floor(Date.now()/1000) + ret.expires_in;

	 		dbLocal.setItem('googledrive.accessToken',this.accessToken);
			dbLocal.setItem('googledrive.refreshToken',this.refreshToken);
			dbLocal.setItem('googledrive.expiresOn',this.expiresOn);
		
			if(! (typeof callback === 'undefined')){
				callback();
			}
		},
		
		onRefreshedTokenReceived: function(data, callback){	
			//parse response
		    var ret = JSON.parse(data.responseText);
			
			Tomahawk.log('Old access token : ' + this.accessToken);
			Tomahawk.log('New access token : ' + ret.access_token);

			this.accessToken = ret.access_token;
			this.expiresOn = Math.floor(Date.now()/1000) + ret.expires_in;

	 		dbLocal.setItem('googledrive.accessToken',this.accessToken);
			dbLocal.setItem('googledrive.expiresOn',this.expiresOn);
		
			if(! (typeof callback === 'undefined')){
				callback();
			}
		},
		
		tokenExpired: function(){
			return (Math.floor(Date.now()/1000) > this.expiresOn);
		},
		
		getRefreshedAccessToken: function(callback){
				var that = this;
				var params = 'grant_type=refresh_token'
							 + '&refresh_token=' + this.refreshToken
						     + '&client_id='     + this.clientId 
						     + '&client_secret=' + this.clientSecret;
										   
				Tomahawk.asyncPostRequest(this.tokenUrl, params, function(data){
															 this.onRefreshedTokenReceived(data, callback);
													     }.bind(this));
		},
        
        queryFailure: function(data) {
    		Tomahawk.log("Request Failed : " + data.text);
    	}

    }
});

var dbLocal = {
			setItem: function(a1, a2){
						window.localStorage.setItem(a1,a2);
					},
			getItem: function (key, defaultResponse){
			 			var result = window.localStorage.getItem(key);
			 			result = (result == null)? defaultResponse : result;
			 			
			 			Tomahawk.log("DB: loaded "+key+" : '"+ result+"' ");
			 			
			 			return result; 
					 }	
};


Tomahawk.resolver.instance = GoogleDriveResolver;

function DumpObjectIndented(obj, indent)
{
  var result = "";
  if (indent == null) indent = "";

  for (var property in obj)
  {
    var value = obj[property];
    if (typeof value == 'string')
      value = "'" + value + "'";
    else if (typeof value == 'object')
    {
      if (value instanceof Array)
      {
        // Just let JS convert the Array to a string!
        value = "[ " + value + " ]";
      }
      else
      {
        // Recursive dump
        // (replace "  " by "\t" or something else if you prefer)
        var od = DumpObjectIndented(value, indent + "  ");
        // If you like { on the same line as the key
        //value = "{\n" + od + "\n" + indent + "}";
        // If you prefer { and } to be aligned
        value = "\n" + indent + "{\n" + od + "\n" + indent + "}";
      }
    }
    result += indent + "'" + property + "' : " + value + ",\n";
  }
  return result.replace(/,\n$/, "");
}
