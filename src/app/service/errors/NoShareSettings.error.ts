export class NoShareSettingsError extends Error {
    dir: string;
    constructor(dir: string) {
        super();
        this.dir = dir;
        Object.setPrototypeOf(this, NoShareSettingsError.prototype);
    }
}
