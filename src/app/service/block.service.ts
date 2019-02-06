import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class BlockService {

  public block = new BehaviorSubject<boolean>(false);
  constructor() { }

  public set(b: boolean) {
    this.block.next(b);
  }

  public subject() {
    return this.block;
  }
}
