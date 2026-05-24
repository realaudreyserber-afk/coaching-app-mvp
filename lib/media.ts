import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase/client";

/**
 * Client-side image compression using HTML5 Canvas.
 * Resizes the image keeping aspect ratio and outputs a JPEG Blob.
 */
export async function compressImage(
  file: File,
  maxWidth = 1200,
  quality = 0.85
): Promise<Blob> {
  if (typeof window === "undefined") {
    throw new Error("compressImage can only be executed in the browser environment");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(new Error("Canvas context could not be created"));
        }

        // Draw image into canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas content to JPEG blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Image compression failed, blob is null"));
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Uploads a progress photo blob to Firebase Cloud Storage.
 * @param uid User ID
 * @param blob Compressed image blob
 * @param type Photo type ('face' | 'profile' | 'back')
 * @param dateStr Date in YYYY-MM-DD format
 * @returns Fully accessible storage HTTPS download URL
 */
export async function uploadProgressPhoto(
  uid: string,
  blob: Blob,
  type: "face" | "profile" | "back",
  dateStr: string
): Promise<string> {
  const fileName = `${dateStr}_${type}.jpg`;
  const storageRef = ref(storage, `users/${uid}/photos/${fileName}`);
  
  await uploadBytes(storageRef, blob, {
    contentType: "image/jpeg",
    customMetadata: {
      uploadedAt: new Date().toISOString(),
      type: type,
    },
  });

  return await getDownloadURL(storageRef);
}
