import * as z from "zod";

export const apiWriteSingleFileRequestSchema = z.object({
  filePath: z.string(),
  fileContent: z.string(),
});

export const apiWriteMultipleFilesRequestSchema = z.array(
  z.object({
    filePath: z.string(),
    fileContent: z.string(),
  })
);

export const apiWriteFileRequestSchema = apiWriteSingleFileRequestSchema.or(
  apiWriteMultipleFilesRequestSchema
);

export type ApiWriteSingleFileRequestType = z.infer<
  typeof apiWriteSingleFileRequestSchema
>;
export type ApiWriteMultipleFilesRequestType = z.infer<
  typeof apiWriteMultipleFilesRequestSchema
>;
export type ApiWriteFileRequestType = z.infer<typeof apiWriteFileRequestSchema>;
