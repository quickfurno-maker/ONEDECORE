"use server";

import { runCommerceProductMediaUpload } from "./commerce-media";

export async function uploadCommerceProductMediaAction(formData: FormData) {
  return runCommerceProductMediaUpload(formData);
}
