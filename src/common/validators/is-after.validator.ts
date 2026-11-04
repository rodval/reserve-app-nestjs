import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Validador propio: la fecha decorada debe ser posterior a otra propiedad
 * del mismo DTO.
 *
 *   @IsAfter('startAt') endAt: Date;
 *
 * Si la otra propiedad no es una fecha válida no reportamos nada: ese error
 * ya lo informa su propio @IsDate().
 */
export function IsAfter(property: string, options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isAfter',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [relatedName] = args.constraints as [string];
          const related = (args.object as Record<string, unknown>)[relatedName];
          if (!(related instanceof Date) || isNaN(related.getTime())) {
            return true;
          }
          return value instanceof Date && value.getTime() > related.getTime();
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} debe ser posterior a ${String(args.constraints[0])}`;
        },
      },
    });
  };
}
