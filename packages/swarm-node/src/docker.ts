import Docker from 'dockerode';

const docker = new Docker(); // defaults to /var/run/docker.sock

export interface ContainerConfig {
    name: string;
    image: string;
    env?: Record<string, string>;
    memoryMb?: number;
    cpuCores?: number;
}

/**
 * Ensures a docker image exists locally, pulling it if it doesn't.
 */
export async function pullImageIfNotExists(image: string): Promise<void> {
    try {
        await docker.getImage(image).inspect();
    } catch {
        console.log(`Pulling image: ${image}`);
        await new Promise((resolve, reject) => {
            docker.pull(image, (err: Error, stream: NodeJS.ReadableStream) => {
                if (err) return reject(err);
                docker.modem.followProgress(stream, (onFinishedErr) => {
                    if (onFinishedErr) return reject(onFinishedErr);
                    resolve(true);
                });
            });
        });
    }
}

/**
 * Starts a new container for a lease workload.
 * @returns The new container's ID
 */
export async function startContainer(config: ContainerConfig): Promise<string> {
    await pullImageIfNotExists(config.image);

    const envArray = Object.entries(config.env || {}).map(([k, v]) => `${k}=${v}`);

    const container = await docker.createContainer({
        Image: config.image,
        name: config.name,
        Env: envArray,
        HostConfig: {
            Memory: config.memoryMb ? config.memoryMb * 1024 * 1024 : undefined,
            CpuCount: config.cpuCores,
        }
    });

    await container.start();
    return container.id;
}

/**
 * Stops and removes a container.
 */
export async function stopContainer(containerId: string): Promise<void> {
    const container = docker.getContainer(containerId);
    try {
        await container.stop();
    } catch (err: any) {
        if (err.statusCode !== 304) { // 304 = already stopped
            throw err;
        }
    }
    await container.remove({ force: true });
}

/**
 * Gets the current status of a container (e.g. running, exited).
 */
export async function getContainerStatus(containerId: string): Promise<string> {
    try {
        const container = docker.getContainer(containerId);
        const info = await container.inspect();
        return info.State.Status;
    } catch (err: any) {
        if (err.statusCode === 404) return 'removed';
        throw err;
    }
}

/**
 * Gets recent logs from a container.
 */
export async function getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
    try {
        const container = docker.getContainer(containerId);
        const logs = await container.logs({
            stdout: true,
            stderr: true,
            tail,
            timestamps: true,
        });
        return logs.toString('utf-8');
    } catch (err: any) {
        if (err.statusCode === 404) return '';
        throw err;
    }
}
