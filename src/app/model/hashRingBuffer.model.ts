export class HashRingBuffer {
    public static readonly MAX_SIZE = 100;
    private hashes: string[] = [];

    public static fromRaw(raw: string): HashRingBuffer {
        const populated: HashRingBuffer = new HashRingBuffer();
        populated.hashes = JSON.parse(raw).hashes;
        return populated;
    }
    public hashPreviouslyUsed(toCheck: string): boolean {
        return this.hashes.includes(toCheck);
    }
    public push(newHash: string) {
        if (this.hashes.length === HashRingBuffer.MAX_SIZE) {
            this.hashes.shift();
        }
        this.hashes.push(newHash);
    }
    public getAllHashes(): string[] {
        return this.hashes;
    }
}
