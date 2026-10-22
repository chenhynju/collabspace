import {IsString,MinLength,MaxLength} from 'class-validator';
export class ChangePasswordDto {
 @IsString() @MinLength(1) @MaxLength(72) currentPassword!:string;
 @IsString() @MinLength(8) @MaxLength(72) newPassword!:string;
 @IsString() @MinLength(8) @MaxLength(72) confirmPassword!:string;
}
