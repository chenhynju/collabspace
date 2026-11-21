import { Transform } from "class-transformer";
import { IsString, Length } from "class-validator";

export class UpdateProfileDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 50, { message: "姓名需要 1–50 个字符" })
  name!: string;
}
