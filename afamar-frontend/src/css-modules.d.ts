/* CSS Modules type declaration.
   Each .module.css file exports a Record<string, string>.
   Using `as string` casts lets us index dynamically without TS errors. */

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
