import { StructType } from "./StructType";

export class DoubleType extends StructType<number, number> {
  override get isDouble(): boolean {
    return true;
  }

  constructor() {
    super(8, true);
  }
}
