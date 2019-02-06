import Semaphore from 'semaphore-async-await';

export async function mutexify(mutex: Semaphore, contract: string, label: string, func) {
    console.log(`[${contract}] (${label}) waiting for mutex`);
    const start = new Date().getTime();
    const val = await mutex.execute(async () => {
        console.log(`[${contract}] (${label}) aquired mutex`);
        return await func();
    });
    const stop = new Date().getTime();
    const duration = stop - start;
    console.log(`[${contract}] (${label}) returning mutex - took it for ${duration}ms`);
    return val;
}
