export class ReceiverUnknownInSharuError extends Error {
    constructor() {
        super();
        Object.setPrototypeOf(this, ReceiverUnknownInSharuError.prototype);
    }
}
