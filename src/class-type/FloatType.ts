import { StructType } from "./StructType";

export class FloatType extends StructType<number, number> {
  override get isFloat(): boolean {
    return true;
  }

  constructor() {
    super(4, true);
  }
}
