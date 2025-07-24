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

import { SerialPort } from "serialport"
import EventEmitter from "events";
import fs from "fs";
import { ErrorCallback } from "@serialport/stream";

import Telegram from "./modules/telegram"
import crcFunction from "./modules/crc"
import Memory from "./modules/memory"
// eepDesc is an Array with Description of all eeps and eep funcs used to look up description (in plain english)
import eepDesc from "./modules/eepDesc"
var parser = require("serialport-enocean-parser")
// the eepResolvers used to extract data from known sensors. you can push your own handlers here
import EepResolvers from "./modules/eep"

export default class SerialPortListener extends EventEmitter {
	private memory = new Memory()
	eepResolvers = EepResolvers;
	private timeout: number;
	private configFilePath: string;
	private base: string;
	// an array of emmiter, all events emitted are emitted on all emitters. start with self, but you can push your own emitters here.
	// for example: add a socket.io object to this array, to have all events automaticly forwarded to the browser.
	emitters: any[] = [];
	private configFile: any|undefined;

	private serialPort: SerialPort|null = null;
	private state: string|undefined; //part of the getBase Hack. Sometimes the call to get base does not return a response. state is used to repeat the process until we have a base address
	
	crc = crcFunction;

	constructor(private config: any = {}) {
		super();

		this.timeout        = config.timeout ? config.timeout : 60 // set the timeout for tech in and forget auto mode to 60 s if not otehrwise specified
		this.configFilePath = config.configFilePath ? config.configFilePath : __dirname + "/config.json" // use the default config file. its recommended to use your own especially when hacking on this module.

		// read the config object passed to the constructor. fill the non existin fileds with defaults
		if(!fs.existsSync(this.configFilePath)){
			fs.writeFileSync(this.configFilePath,'{"base":"00000000"}')
		}

		this.emitters.push(this);

		// this.mem    = new Memory( this ); // initialize the Memory implementation used for learning an forgetting sensors. all meaningfull events are emitted there

		try {
			this.configFile = require(this.configFilePath) // load the config file
			this.base = this.configFile.base // load the base address stored in the config file. It should be initialized with "00000000"
		} catch(e) {
			this.base = "00000000";
		}
	}


	info(id, callback) {
		this.memory(id, callback);
	}

	// used to close the serial port. usefull for CLI inerfaces or tests
	close(callback?: ErrorCallback) {
		this.serialPort?.close(callback)
	}

	private _buffer: Buffer|undefined = undefined;

	private fillFrame(buffer: any) {
		if(!buffer) return;
		if(!this._buffer) this._buffer = Buffer.from(buffer);
		else this._buffer = Buffer.concat([this._buffer, buffer]);
	}
	
	private extractFrame() {
		if(!this._buffer || this._buffer.length == 0) return undefined;

		while(this._buffer.length > 0 && this._buffer[0] != 0x55) {
			this._buffer = this._buffer.slice(0, 1);
		}

		if(!this._buffer || this._buffer.length == 0) return undefined;

		//check we have header
		if(this._buffer.length < 6) return undefined;

		const length = this._buffer[1] * 16 + this._buffer[2] + this._buffer[3];
		const total_length = 6 + length + 1;
		if(this._buffer.length < total_length) return undefined;

		const header = this._buffer.subarray(1, 1 + 4);
		const data_and_optional = this._buffer.subarray(6, 6 + length);

		const crc_in_header = this._buffer[5];
		const crc_in_data_and_optional = this._buffer[total_length-1];
		const crc_header = this.crc(header);
		const crc_data_and_optional = this.crc(data_and_optional);

		if(crc_in_header != crc_header || crc_in_data_and_optional != crc_data_and_optional) {
			console.log("invalid crc", this._buffer);
			this._buffer = undefined;
			return undefined;
		}

		const telegram = this._buffer.subarray(0, total_length);
		if(this._buffer.length >= total_length) {
			this._buffer = this._buffer.slice(total_length);
		} else {
			console.log("invalid lengths, resetting");
			this._buffer = undefined;
		}
		return telegram;
	}

	listen(port: string) {
		// open the serial port
		// use /dev/ttyUSBx for USB Sticks
		// use /dev/ttyAMA0 for enocean pi
		// use /dev/COM1 for USB Sticks on Windows
		const serialPort = this.serialPort = new SerialPort({ path: port, baudRate: 57600});

		serialPort.pipe(parser)

		serialPort.on("open", () => {
			// when the serial port successfully opend
			if (this.configFile.base === "00000000" || !this.configFile.hasOwnProperty( "base" ) ) { // if we dont know the base address yet
				this.getBase() // get the base address from the attached device
			} else { // if we know the base address
				this.state = "ready" // part of the getBase Hack

				// emit the ready event. we are now ready to receive and send telegrams
				this.emitters.forEach(emitter => emitter.emit("ready"));
			}
			serialPort.on('data', (data) => {
				this.fillFrame(data);

				var telegram: Buffer|undefined = undefined;
				var hack = 0;

				do {
					telegram = this.extractFrame();
					if(telegram) {
						this.receive(telegram);
					} else {
						console.log("invalid, waiting for more data ...");
					}

					hack++;
				} while(telegram && hack < 255);
			});
			serialPort.on("error", (error) => {
				this.emitters.forEach(emitter => emitter.emit("error", error));
			});
			serialPort.on("disconnect", (error) => {
				this.emitters.forEach((emitter) => emitter.emit("disconnect", error));
			});
			serialPort.on("close", () => {
				this.emitters.forEach((emitter) => emitter.emit("close"));
			});
		})
	}

	private receive(buf: Buffer) {
		// handle the receiving of telegrams. this can be used to simulate the recieving part... good for testing ;-)
		var telegram = new Telegram(buf) // create a new telegram

		this.emitters.forEach((emitter) => emitter.emit("data", telegram));

		if(telegram.packetType != 2) {
			return;
		}

		// handle getting the base address. if we request request the base address from our device, it response with a telegram of type 2
		// the telegram implemetation has already extracted the address.
		if(telegram.hasOwnProperty("base")) { // if this Response holds our base address
			this.base       = telegram.base // make it globaly available
			this.configFile.base = telegram.base // write to the config file
			fs.writeFile(this.configFilePath, JSON.stringify(this.configFile, null, 4), (err) => {
				if(err) {
					// error saving config file
				} else {
					// when the file was successfully saved
					this.state = "ready" // part of the get Base Hack
					this.emitters.forEach((emitter) => {
						// emit the ready event. when we start listening and we dont know the base address, the ready event is not fired. so do it here.
						// but remember that every call to getBase also emits "ready"
						emitter.emit( "ready" )
						emitter.emit( "base" , telegram.base ) // also fire the base event to everyone. also propagete the base address
					});
				}
			})
		}

		this.emitters.forEach((emitter) => {
			emitter.emit( "response" , telegram ) // emit all other response telegrams to everyone
		});
	}

	send(msg: string) {
		// very simple send implemetation. expects a string (hex)
		try{
			var buf1 = new Buffer(msg, "hex") // turn msg into a Buffer

			this.serialPort?.write(buf1) // write it to the serial port

			this.emitters.forEach((emitter) => {
				emitter.emit("sent", msg) // emit a sent event when we where able to sen something. does not mean the sending itself was successful though
			});
		} catch(err) {
			this.emitters.forEach((emitter) => {
				emitter.emit("sent-error", { err, msg }); // emit en error whe somthing went wrong
			});
		}
	}

	sendAsync(msg: string): Promise<void> {
		// very simple send implemetation. expects a string (hex)
		return new Promise((resolve, reject) => {
			try{
				var buf1 = new Buffer(msg, "hex") // turn msg into a Buffer
				this.serialPort?.write(buf1, (err) => {
					if (err) {
						reject(err)
					} else {
						resolve();
					};
				}) // write it to the serial port

				this.emitters.forEach((emitter) => {
					emitter.emit( "sent" , msg ); // emit a sent event when we where able to sen something. does not mean the sending itself was successful though
				});
			} catch(err) {
				this.emitters.forEach((emitter) => {
					emitter.emit("sent-error", { err, msg } ); // emit en error whe somthing went wrong
				});
			}
		});
	}
	
	getBase() {
		// code to get the base address ( 55 0001 00 05 70 08 38 )
		// 55   = startbyte
		// 0001 = datalength (data is only one Byte)
		// 00   = optionallength t
		// 05   = telegramtype (05 = Common Command)
		// 70   = header checksum
		// 08   = Command Code (08 = Read Base)
		// 38   = CRC of Data
		this.send("5500010005700838")
		// somtimes the controler does not returen the base address.
		// if the address is not know, this may cause the program to hang (ie. not fire the "ready" event)
		// to fix this, see if the ready event got fired after 1 second, if not fire request the base addres again.
		// this is a dirty hack i know... so what, it works ;-)
		setTimeout(() => {
			if (this.state !== "ready") this.send("5500010005700838");
		}, 1000 )
	}

	getData(eep: any, data: any) {
		// used to read data from known telegrams
		// can be used as a utilty externaly
		// eep is an eep as a string ( f.e. a5-03-02 )
		// data is the data part of a telegram as a string
		var ret = null // set return to null
		for(var i = 0; i < eepResolvers.length; i++) { // loop through all eepResolvers
			ret = eepResolvers[i](eep , data) // try to decode the data
			if( ret !== null ) {
				return ret // if a resolver returns somthing other than null, we have an answer. return it and be done
				// if not try next.
			}
		}
		// we obviuosly dont have an implementation for this eep yet. return an unknown value
		return [{
			type: "unknown",
			unit: "unknown",
			value: "unknown"
		}]
	}

	// a helper function
	pad(num: string, size: number) { // fill a string with leading zeros up to size
		var s = "00000000000000000000000000000000" + num // maximum number of zero we need
		return s.substr( s.length - size ) // cut to size
	}

	register(socket: any) {
		// rergister for event emitters.
		// we are lsitening for the following events:
		/*socket.on("get-learning-state", () => {
			socket.emit("learning-state", this.learnMode ) // returns info for one single sensor
		});*/
		// socket.on("start-learning" , this.startLearning ) // start learn mode
		// socket.on("start-forgetting" , this.startForgetting ) // start forget mode
		// socket.on("stop-learning" , this.stopLearning ) // stop learn mode
		// socket.on("stop-forgetting" , this.stopForgetting ) // stop forget mode
		socket.on("send", this.send) // send data; expects a string as parameter
		// socket.on("learn" , this.learn ) // manualy learn/save/update a sensor description. expects a sensor description
		// socket.on("forget" ,this.forget ) // deletes a sensor
		/*socket.on("get-all-sensors" , function( ) {
			this.getSensors(function(sensors) {
				socket.emit("all-sensors", sensors ) // returns a list of all known sensors to this one socket
			})
		}.bind( this ) )*/
		/*socket.on( "get-sensor-info" , function( id ) {
			this.info(id, function(sensor) {
				socket.emit("sensors-info", sensor ) // returns info for one single sensor
			})
		}.bind( this) )*/
		/*socket.on( "get-last-sensor-value" , function( id ) {
			socket.emit("last-sensors-value", {err:"todo"}) // returns info for one single sensor
			//this.getLastValues(id)
			//.then(function(value) {
			//socket.emit("last-sensors-value", value) // returns info for one single sensor
			//});
		}.bind( this) )*/
		//socket.on( "get-last-sensor-value" , async function( id ) {
		//	socket.emit("last-sensors-value", await this.getLastValues( id ) ) // returns info for one single sensor
		//}.bind( this) )
	}
}
