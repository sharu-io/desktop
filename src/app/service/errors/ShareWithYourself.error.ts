export class ShareWithYourselfError extends Error {
    constructor() {
        super();
        Object.setPrototypeOf(this, ShareWithYourselfError.prototype);
    }
}
