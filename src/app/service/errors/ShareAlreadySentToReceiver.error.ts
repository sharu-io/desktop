export class ShareAlreadySentToReceiverError extends Error {
    constructor() {
        super();
        Object.setPrototypeOf(this, ShareAlreadySentToReceiverError.prototype);
    }
}
