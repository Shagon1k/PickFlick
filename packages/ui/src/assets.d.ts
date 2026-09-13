declare module "*.webp" {
  const asset: string | { readonly src: string; readonly width: number; readonly height: number };
  export default asset;
}

declare module "*.png" {
  const asset: string | { readonly src: string; readonly width: number; readonly height: number };
  export default asset;
}
