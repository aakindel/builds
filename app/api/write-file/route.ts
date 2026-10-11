import { type NextRequest, type NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { consoleLog } from "@/utils";
import { type ApiResponseMessageType } from "@/app/api/api-types";
import {
  getBadRequestNextResponse,
  getInternalServerErrorNextResponse,
  getNextResponse,
} from "@/app/api/api-utils";
import { apiWriteFileRequestSchema } from "./validation";

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponseMessageType>> {
  try {
    // https://codedamn.com/news/javascript/zod-getting-started : parse w/ zod
    const rawRequestPayload = await request.json();

    // validate api request
    const parsedRequestPayload =
      await apiWriteFileRequestSchema.safeParseAsync(rawRequestPayload);

    // if api request is valid
    if (parsedRequestPayload.success) {
      // if multiple files are being written
      if (Array.isArray(parsedRequestPayload.data)) {
        for (const requestPayload of parsedRequestPayload.data) {
          const { filePath, fileContent } = requestPayload;

          writeFile({ filePath, fileContent });
        }

        return getNextResponse({
          type: "success-message",
          message: `successfully wrote files: ${parsedRequestPayload.data.map((requestPayload) => requestPayload.filePath).join(", ")}`,
          status: 200,
        });
      }

      // if a single file is being written
      const { filePath, fileContent } = parsedRequestPayload.data;

      writeFile({ filePath, fileContent });

      return getNextResponse({
        type: "success-message",
        message: `successfully wrote file: ${filePath}`,
        status: 200,
      });
    } else {
      // if api request is invalid
      return getBadRequestNextResponse({ parsedRequestPayload });
    }
  } catch (error) {
    // if api request fails
    return getInternalServerErrorNextResponse({ error });
  }
}

const writeFile = ({
  filePath,
  fileContent,
}: {
  filePath: string;
  fileContent: string;
}) => {
  const resolvedPath = path.resolve(filePath);
  const dirName = path.dirname(resolvedPath);
  const fileExtension = getFileExtensionFromFilePath(resolvedPath);
  const prettierExtensions = [
    "js",
    "ts",
    "jsx",
    "tsx",
    "json",
    "md",
    "css",
    "scss",
    "html",
  ];

  consoleLog(`writing file: \`${resolvedPath}\`\n`);

  // if the directory does not exist, create the directory
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }

  fs.writeFileSync(resolvedPath, fileContent);

  if (
    prettierExtensions.includes(
      fileExtension.startsWith(".") ? fileExtension.slice(1) : fileExtension
    )
  ) {
    execSync(`npx prettier --write ${resolvedPath}`);
  }

  consoleLog(`file written: \`${resolvedPath}\`\n\n`);
};

const getFileExtensionFromFilePath = (filePath: string) => {
  return path.extname(filePath);
};
