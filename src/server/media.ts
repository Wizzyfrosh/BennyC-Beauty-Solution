import "server-only";
import sharp from "sharp";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { boundedBody, type StaffActor } from "./admin-route";
import { mutation, audit, digest } from "./mutations";
import { getDb } from "./db";
import { DomainError } from "./domain-error";

export async function uploadProductImage(request: Request, actor: StaffActor) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    throw new DomainError(
      415,
      "IMAGE_FORM_REQUIRED",
      "Choose an image file to upload.",
    );
  const bytes = await boundedBody(request, 6 * 1024 * 1024);
  const form = await new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: bytes,
  }).formData();
  const productId = z.uuid().parse(form.get("productId"));
  const altText = z.string().trim().min(3).max(250).parse(form.get("altText"));
  const file = form.get("file");
  if (
    !(file instanceof File) ||
    file.size < 1 ||
    file.size > 5 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw new DomainError(
      400,
      "INVALID_IMAGE",
      "Use a JPEG, PNG or WebP image up to 5 MB.",
    );
  const buffer = Buffer.from(await file.arrayBuffer());
  let normalized: Buffer;
  try {
    const image = sharp(buffer, {
      limitInputPixels: 20000000,
      animated: false,
    });
    const meta = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format ?? "") ||
      (meta.pages ?? 1) > 1 ||
      !meta.width ||
      !meta.height
    )
      throw Error();
    normalized = await image
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new DomainError(
      400,
      "INVALID_IMAGE",
      "This file is not a supported single image.",
    );
  }
  if (
    !(await getDb().product.findUnique({
      where: { id: productId },
      select: { id: true },
    }))
  )
    throw new DomainError(404, "NOT_FOUND", "Product not found.");
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME,
    apiKey = process.env.CLOUDINARY_API_KEY,
    apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret)
    throw new DomainError(
      503,
      "MEDIA_NOT_CONFIGURED",
      "Image uploads are not ready. The owner must configure the image service.",
    );
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  const publicId = `bennyc/products/${productId}/${randomUUID()}`;
  const uploaded = await new Promise<UploadApiResponse>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          public_id: publicId,
          resource_type: "image",
          overwrite: false,
          timeout: 20000,
        },
        (error, result) =>
          error || !result
            ? reject(
                new DomainError(
                  503,
                  "UPLOAD_FAILED",
                  "The image could not be uploaded. Please retry.",
                ),
              )
            : resolve(result),
      )
      .end(normalized);
  });
  try {
    if (
      uploaded.public_id !== publicId ||
      new URL(uploaded.secure_url).hostname !== "res.cloudinary.com" ||
      !uploaded.asset_id
    )
      throw new DomainError(
        503,
        "INVALID_MEDIA_RESPONSE",
        "The uploaded image could not be confirmed.",
      );
    const result = await mutation(
      actor,
      true,
      "catalogue.image",
      request.headers.get("Idempotency-Key"),
      { productId, altText, fileHash: digest(buffer.toString("base64")) },
      async (tx, operationId) => {
        await tx.$queryRaw`SELECT id FROM public.products WHERE id=${productId}::uuid FOR UPDATE`;
        const image = await tx.productImage.create({
          data: {
            productId,
            provider: "CLOUDINARY",
            assetId: uploaded.asset_id,
            publicId: uploaded.public_id,
            secureUrl: uploaded.secure_url,
            version: uploaded.version,
            format: uploaded.format,
            width: uploaded.width,
            height: uploaded.height,
            altText,
            sortOrder: -Math.floor(Date.now() / 1000),
          },
        });
        await audit(
          tx,
          actor,
          operationId,
          "product.image_uploaded",
          "product",
          productId,
          { imageId: image.id },
        );
        return { id: image.id, assetId: image.assetId, url: image.secureUrl };
      },
    );
    if (result.assetId !== uploaded.asset_id)
      await cloudinary.uploader.destroy(uploaded.public_id, {
        resource_type: "image",
      });
    return result;
  } catch (error) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    } catch {
      console.error("Unattached image cleanup required");
    }
    throw error;
  }
}
