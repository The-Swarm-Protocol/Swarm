import si from 'systeminformation';

export interface SystemProperties {
    cpuCores: number;
    ramGb: number;
    platform: string;
    gpus: {
        vendor: string;
        model: string;
        vram: number;
    }[];
}

export interface SystemHealth {
    cpuLoadPercent: number;
    ramUsedGb: number;
    uptimeSec: number;
}

/**
 * Gets static hardware properties of the host machine once at startup.
 */
export async function getSystemProperties(): Promise<SystemProperties> {
    const [cpu, mem, os, gpus] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.osInfo(),
        si.graphics()
    ]);

    return {
        cpuCores: cpu.physicalCores,
        ramGb: Math.round(mem.total / (1024 * 1024 * 1024)),
        platform: os.platform,
        gpus: gpus.controllers.map(gpu => ({
            vendor: gpu.vendor,
            model: gpu.model,
            vram: gpu.vram || 0
        }))
    };
}

/**
 * Polls current resource utilization to report as periodic heartbeats.
 */
export async function getSystemHealth(): Promise<SystemHealth> {
    const [load, mem, time] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.time()
    ]);

    return {
        cpuLoadPercent: load.currentLoad,
        ramUsedGb: mem.used / (1024 * 1024 * 1024),
        uptimeSec: time.uptime
    };
}
