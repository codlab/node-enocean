// 	   This file is part of node-enocean.

//     node-enocean. is free software: you can redistribute it and/or modify
//     it under the terms of the GNU General Public License as published by
//     the Free Software Foundation, either version 3 of the License, or
//     (at your option) any later version.

//     node-enocean. is distributed in the hope that it will be useful,
//     but WITHOUT ANY WARRANTY; without even the implied warranty of
//     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//     GNU General Public License for more details.

//     You should have received a copy of the GNU General Public License
//     along with node-enocean.  If not, see <http://www.gnu.org/licenses/>.



//     # memory implementation.
//     this module implements saving and deleting sensors as well as hanbling telegrams from known sensor
//     this implementation uses the fiesystem to stor sensor info

var mongoose = require("mongoose");

var db = undefined;
var EnoceanSensor = undefined;


function getEEP(rorg, rorg_func, rorg_type) {
	return (rorg+"-"+rorg_func+"-"+rorg_type).toLowerCase();
}

function getByte(telegram_byte_str, index) {
	return telegram_byte_str[index * 2 ] + telegram_byte_str[index * 2 + 1];
}

module.exports     = function(app,config){
	this.timerId=null

	app.learnMode  = "on"
	app.forgetMode = "off"

	app.connect = function(mongo_path) {
		mongoose.connect(mongo_path);
		db = mongoose.connection;

		db.on("error", function(err) {
			console.error.bind(console, 'connection error:');
		});

		db.once('open', function() {
			console.log("connection ok");

			var EnoceanSensorScheme = mongoose.Schema({
				id: String,
				eep: String,
				manufacturer: String,
				title: String,
				desc: String,
				eepFunc: String,
				eepType: String
			});

			EnoceanSensor = mongoose.model('EnoceanSensor', EnoceanSensorScheme);

			app.emitters.forEach( function( emitter ) {
				emitter.emit( "sensor-db-open" , {});
			});

		});

	}

	app.on( "data" , function( data ) {
		console.log("having data", data);
		EnoceanSensor && EnoceanSensor.findOne({ id: data.senderId }, function (err, sensor) {
			if( sensor != undefined) {
				if( data.learnBit === 1 || data.choice === "f6" || data.choice === "d1") {
					// but only if it is not a learn Telegram (learnBit==1)
					data.sensor = sensor // attach that info to the telegram data
					data.values = app.getData( sensor.eep , data.raw ) // actually extract the Data

					//was also saving last data in db but removed it, useful?
					app.emitters.forEach(function(emitter){
						emitter.emit("known-data",data) // and emmit an event propagating the extracted Data downstream
					} )
				} else {
					// if it is a learn telegram, check if we are in "teach in"-mode
					if( app.learnMode === "on" ) {
						// we are in teach in mode
						// And we have just received a "tech in" telegram...
						// but we allready know this sensor
						app.learnMode = "off" // turn of "teach in"-mode to prevent unwanted sensors to be tought in accedently
						app.emitters.forEach( function( emitter ) {
							emitter.emit( "learn-mode-stop" , { code : 1 , reason : "already known sensor" } ) // tell everyone that we stop the "teach-in"-mode
						} )
					}
					if( app.forgetMode === "on" ) {
						// we are in forget mode, and we received a "teach-in" telegram of a known sensor
						// this indicates that it should be forgotten.
						app.forget( data.senderId ) // delete the sensor
					}
				}
				if( app.forgetMode === "on" && data.choice === "f6" ) {
					// we are in forget mode, and we received an RPS telegram form a known sensor
					// but the learnBit is not set, as RPS telegramns don't have learnBits...
					// this indicates that it should be forgotten.
					app.forget( data.senderId ) // delete the sensor
				}
			} else {
				// ???? we don't know this sensor ???
				if( data.learnBit === 0 ) {
					// but it's a "teach in"-telegram, so it wants to tell us about itself
					if( app.learnMode === "on" ) {
						// we are in learnMode, so extract the sensor info frm the telegram
						// and save that info
						if(data.choice==="d5") data.eep="d5-00-01" //its a 1BS Telegram there is currently only 1 defined so assume d5-00-01
						app.learn( {
							id           : data.senderId,
							eep          : data.eep,
							manufacturer : data.manufacturer,
							title        : "New " + app.eepDesc[data.eep.substring(0,5)],           // give it some name
							desc         : "I'm a new sensor...",  // and some description
							eepFunc      : app.eepDesc[data.eep.substring(0,5)], // finde the func description of the eep
							eepType      : app.eepDesc[data.eep]   // find the Type description of the eep
						} )
					} else {
						// we are not in teach in mode, but this is a "tech in" telegram
						if(data.choice !== "f6" ) {
							// "RPS" telegrams do not have a lernBit. depending on the Data Byte sometimes the Bit used for indicating "teach-in"-telegrams is set
							// prevent false positives
							app.emitters.forEach( function( emitter ) {
								emitter.emit( "unknown-teach-in" , data ) // tell everyone we received an unknown "teach-in"
							} )
						}
					}
				} else {
					// we don't know the sender and the leranBit is not set
					if( data.choice === "f6" && app.learnMode === "on" ) {
						// but this is an "RPS" signal ( remeber RPS don't have learn bits ), and we are in teach in mode
						// so treat every RPS received during teach in a a request to be tought in
						// do so...
						app.learn( {
							id           : data.senderId,
							eep          : "f6-02-03",
							manufacturer : "unknown",
							title        : "New RPS Switch",       // give it some name
							desc         : "I'm a new sensor...",  // and some description
							eepFunc      : app.eepDesc["f6-02"], // finde the func description of the eep
							eepType      : app.eepDesc["f6-02-03"]   // find the Type description of the eep
						} )
					} else {
						// we are not in learnMode and the sensor of this telegram is not known.
						// neither is this a learn telegram.
						//retrieve eep to be sure about the device
						var rorg =  getByte(data.rawByte, 6);
						var rorg_func = getByte(data.rawByte, 6 + 6);
						var rorg_type = getByte(data.rawByte, 6 + 7);
						var eep = getEEP(rorg, rorg_func, rorg_type);

						var format = app.getData(eep, data.raw);
						if(format == undefined || (format.length == 0 && format[0].type == "unknown")) {
							app.emitters.forEach( function( emitter ){
								emitter.emit( "unknown-data" , data ) // just tell everyone we received something, but we don't know what to do with it
							} )
						}else{
							console.log("no device found but eep seems correct, no need", eep);
						}
					}
				}
			}
		});
	})

	app.startLearning = function( ) {
		// start learnMode ("tech-in"-mode)
		// the learn mode is here to automaticly learn sensors that send a teach in telegram
		app.learnMode = "on"
		app.emitters.forEach( function( emitter ) {
			emitter.emit( "learn-mode-start" , { timeout : app.timeout } ) // propagete that we are ready to learn
		} )
		this.timerId=setTimeout( app.stopLearning , app.timeout * 1000 ) // make sure we stop learning after timeout
	}

	app.stopLearning       = function( ) {
		// stop learnMode
		if( app.learnMode == "on" ) {
			// but only if we are still in leranMode
			app.learnMode  =" off"
			clearTimeout(this.timerId)
			app.emitters.forEach( function( emitter ) {
				emitter.emit( "learn-mode-stop" , { code : 2 , reason : "timeout" } ) // tell everyone we are not in teach in anymore
			} )
		}
	}

	app.startForgetting = function( ) {
		// start the forget mode
		// this is used to delete single sensors, through its teach in telegram.
		app.forgetMode  = "on"
		app.emitters.forEach( function( emitter ) {
			emitter.emit( "forget-mode-start" , { timeout : app.timeout } ) // tell everyone we are in forget-mode
		} )
		this.timerId=setTimeout( app.stopForgetting , app.timeout * 1000 ) // make sure we leave stop mode after timeout
	}

	app.stopForgetting      = function( ) {
		// stop forget Mode
		if( app.forgetMode == "on" ) {
			// but only if we are in forget Mode
			app.forgetMode  = "off"
			clearTimeout(this.timerId)
			app.emitters.forEach( function( emitter ) {
				emitter.emit( "forget-mode-stop" , { code : 2 , reason : "timeout" } ) // tell everyone we are not in forget mode anymore
			} )
		}
	}

	app.learn = function( sensor ) {
		// actually learn a sensor.
		// this function can be call from anywhwere.
		// the sensor object should have the following fileds: id,eep,manufacturer,title,desc
		// this can be used to update sensor info like desc and title...

		if(!EnoceanSensor) return;

		var sensor_db = new EnoceanSensor(sensor); //the object is a proper json
		sensor_db.save(function (err, user) {
			app.learnMode = "off" // stop the learnMode in any case
			clearTimeout(this.timerId)
			app.emitters.forEach( function( emitter ) {
				emitter.emit( "learn-mode-stop" , { code : 0 , reason : "success" } ) // tell everyone we are not in learn mode anymore
			} )

			if(err === undefined) {
				// the file was successfully saved
				app.emitters.forEach( function( emitter ) {
					emitter.emit( "learned" , sensor ) // let's tell everyone we where successfull attach the sensor info of the sensor we just saved
				});
			}else{
				app.emitters.forEach( function( emitter ) {
					emitter.emit( "learn-error" , { err : err, reason: "error saving sensor file to disk" } ) // there was an error saving the file
				});
			}

		});
	}

	app.forget = function( id ) {
		EnoceanSensor && EnoceanSensor.findOneAndRemove({ id: id }, function (err, sensor) {
			app.forgetMode="off" // stop forget Mode
			clearTimeout(this.timerId);
			app.emitters.forEach( function( emitter ) {
				emitter.emit( "forget-mode-stop" , { code : 0 , reason:"success"} ) // and tell the "world" we stoped forget mode
			});


			if( err === undefined) {
				app.emitters.forEach(function(emitter){
					emitter.emit("forgotten",tmp) // let's tell everyone we where successfull, attach the sensor info of the just deleted sensor
				});
			} else {
				app.emitters.forEach( function( emitter ) {
					emitter.emit( "forget-error" , { err : err, reason: "error saving sensor file to disk" } ) // there was an error saving the file
				});
			}
		});
	}

	app.info = function ( id, callback) {
		if(!EnoceanSensor) {
			callback(undefined);
			return;
		}
		EnoceanSensor.findOne({ id: id }, function (err, sensor) {
			callback(sensor);
		});
	}
	app.getLastValues = function(id){
		return getLastData(id)
	}
	app.getSensors = function(callback) {
		if(!EnoceanSensor) {
			callback([]);
			return;
		}
		EnoceanSensor.find({}, function(err, sensors) {
			callback(sensors);
		});
	}
}

function getLastData(id){
	return new Promise(function(resolve,reject){
		db.get(id,function(err,value){
			if(err){reject(err)}else{resolve(value)}
		})
	})
}
