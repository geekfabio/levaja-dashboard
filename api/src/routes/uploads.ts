import type { FastifyInstance } from "fastify";
import { authenticate } from "../lib/authenticate";
import { apiError, dataEnvelope } from "../lib/envelope";
import { UPLOAD_CONTEXTS, readUpload, saveUpload } from "../lib/uploads";
import type { UploadContext } from "../lib/uploads";

function isImage(mimetype: string) {
  return mimetype.toLowerCase().startsWith("image/");
}

function isUploadContext(value: unknown): value is UploadContext {
  return typeof value === "string" && (UPLOAD_CONTEXTS as readonly string[]).includes(value);
}

export async function uploadRoutes(app: FastifyInstance) {
  app.post("/uploads", { preHandler: authenticate }, async (request, reply) => {
    if (!request.isMultipart()) {
      throw apiError("validation", "Envie o ficheiro em multipart/form-data.", {
        issues: [{ field: "file", message: "Falta o ficheiro." }],
      });
    }

    let fileBuffer: Buffer | undefined;
    let mimetype: string | undefined;
    let context: unknown;

    for await (const part of request.parts()) {
      if (part.type === "file" && part.fieldname === "file") {
        fileBuffer = await part.toBuffer();
        mimetype = part.mimetype;
      } else if (part.type === "field" && part.fieldname === "context") {
        context = part.value;
      }
    }

    if (!fileBuffer || !mimetype) {
      throw apiError("validation", "Falta o ficheiro.", { issues: [{ field: "file", message: "Falta o ficheiro." }] });
    }
    if (!isImage(mimetype)) {
      throw apiError("validation", "O ficheiro tem de ser uma imagem.", {
        issues: [{ field: "file", message: "O ficheiro tem de ser uma imagem." }],
      });
    }
    if (!isUploadContext(context)) {
      throw apiError("validation", "Indique o contexto do ficheiro.", {
        issues: [{ field: "context", message: "Indique um contexto válido (cargo, vehicle, delivery ou document)." }],
      });
    }

    const upload = await saveUpload(fileBuffer, mimetype, context);
    reply.status(201).send(
      dataEnvelope({
        id: upload.id,
        url: `/uploads/${upload.id}`,
        content_type: upload.contentType,
      }),
    );
  });

  app.get("/uploads/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const upload = await readUpload(id);
    if (!upload) {
      throw apiError("not_found", "Ficheiro não encontrado.");
    }
    reply.header("content-type", upload.contentType);
    reply.send(upload.buffer);
  });
}
