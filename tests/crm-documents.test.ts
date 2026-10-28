import { test } from "node:test";
import assert from "node:assert/strict";
import { createMockDocuments } from "@/data/crm/mock/documents";
import { isRepositoryError } from "@/data/crm/repositories";
import { useDocumentsStore } from "@/stores/documents-store";

function repo() {
  return createMockDocuments(0);
}

test("upload recusa tipo de ficheiro inválido", async () => {
  const documents = repo();
  await assert.rejects(
    documents.upload({ companyId: "boa-esperanca", name: "x.exe", mime: "application/x-msdownload", size: 100, category: "Outro" }),
    (error: unknown) => {
      assert.ok(isRepositoryError(error));
      assert.equal(error.code, "validation");
      return true;
    },
  );
});

test("upload recusa ficheiro acima de 10 MB", async () => {
  const documents = repo();
  await assert.rejects(
    documents.upload({ companyId: "boa-esperanca", name: "grande.pdf", mime: "application/pdf", size: 11 * 1024 * 1024, category: "Contrato" }),
    (error: unknown) => {
      assert.ok(isRepositoryError(error));
      assert.equal(error.code, "validation");
      return true;
    },
  );
});

test("upload acrescenta à store partilhada", async () => {
  const documents = repo();
  const before = (await documents.list()).length;
  const created = await documents.upload({ companyId: "boa-esperanca", name: "novo.pdf", mime: "application/pdf", size: 1000, category: "Contrato" });
  assert.match(created.id, /^doc-/);
  assert.equal((await documents.list()).length, before + 1);
  assert.ok(useDocumentsStore.getState().documents.some((item) => item.id === created.id));
});

test("remove de id inexistente devolve not_found", async () => {
  const documents = repo();
  await assert.rejects(documents.remove("doc-inexistente"), (error: unknown) => {
    assert.ok(isRepositoryError(error));
    assert.equal(error.code, "not_found");
    return true;
  });
});

test("remove e restore", async () => {
  const documents = repo();
  const created = await documents.upload({ companyId: "boa-esperanca", name: "a-remover.pdf", mime: "application/pdf", size: 1000, category: "Contrato" });
  await documents.remove(created.id);
  assert.ok(!useDocumentsStore.getState().documents.some((item) => item.id === created.id));
  await documents.restore(created);
  assert.ok(useDocumentsStore.getState().documents.some((item) => item.id === created.id));
});
