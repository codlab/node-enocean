export type Sensors<T> = {
	[key: string]: T
}

export type SensorTemperature = Sensors<{hmin: number,hmax: number,tmin: number,tmax: number}>
export type SensorMinMax = Sensors<{min: number, max: number}>
