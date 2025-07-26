export default {
	extractByteValue : (ByteNr: number, minByte: number, maxByte: number, minValue: number, maxValue: number, data: string) => {
		var rawVal  = 0
		var rawByte = parseInt(data,16)

		switch (ByteNr) {
			case 1:
				rawVal = (rawByte & 0xff00) >>> 8
			break
			case 2:
				rawVal = (rawByte & 0xff0000) >>> 16
			break
			case 3:
				rawVal = (rawByte & 0xff000000) >>> 24
			break
			}
		return ((maxValue - minValue) / (maxByte - minByte)) * (rawVal - minByte) + minValue
	},
	extract10BitValue: (ByteBase: number, minByte: number, maxByte: number, minValue: number, maxValue: number, data: string) => {
		var rawVal  = 0
		var rawByte = parseInt(data,16)
		switch(ByteBase){
			case 1 :
				rawVal = (rawByte & 0x3ff00) >>> 8
			break
			case 2 :
				rawVal = (rawByte & 0x3ff0000) >>> 16
			break
			}
		return ((maxValue-minValue)/(maxByte-minByte))*(rawVal-minByte)+minValue
	},
	extract10BitValueReverse: (ByteBase: number, minByte: number, maxByte: number, minValue: number, maxValue: number, data: string) => {
		var rawVal  = 0
		var rawByte = parseInt(data,16)
		switch(ByteBase){
			case 1 :
				rawVal = (rawByte & parseInt("1111111111000000",2)) >>> 6
			break
			case 2 :
				rawVal = (rawByte & parseInt("111111111100000000000000",2)) >>> 14
				//rawVal = (rawByte & 0x3ff0000) >>> 16
			break
			case 3 :
				rawVal = (rawByte & parseInt("11111111110000000000000000000000",2)) >>> 22
				//rawVal = (rawByte & 0x3ff0000) >>> 16
			break
			}
		return ((maxValue-minValue)/(maxByte-minByte))*(rawVal-minByte)+minValue
	},
	extractBitValue: (ByteNr: number, BitStart: number, BitLength: number, data: string) => {
		var rawVal  = 0
		var rawByte = parseInt(data,16)
		switch(ByteNr){
			case 0 :
				rawVal = (rawByte & 0xff)
			break
			case 1 :
				rawVal = (rawByte & 0xff00) >>> 8
			break
			case 2 :
				rawVal = (rawByte & 0xff0000) >>> 16
			break
			case 3 :
				rawVal = (rawByte & 0xff000000) >>> 24
			break
		}
		var finalValue = Math.pow(2,BitStart)
		for(var i=1;i<BitLength;i++){
			finalValue+=Math.pow(2,BitStart+i)
		}
		return ((rawByte & finalValue) >>> BitStart)
	},
	extractBitEnum: (ByteNr: number, BitStart: number, BitLength: number, data: string, ENUM: any[]) => {
		var rawVal  = 0
		var rawByte = parseInt(data,16)
		switch(ByteNr){
			case 0 :
				rawVal = (rawByte & 0xff)
			break
			case 1 :
				rawVal = (rawByte & 0xff00) >>> 8
			break
			case 2 :
				rawVal = (rawByte & 0xff0000) >>> 16
			break
			case 3 :
				rawVal = (rawByte & 0xff000000) >>> 24
			break
		}
		var finalValue = Math.pow(2,BitStart)
		for(var i=1; i<BitLength; i++){
			finalValue+=Math.pow(2,BitStart+i)
		}
		return ENUM[((rawByte & finalValue) >>> BitStart)]
	}
}
