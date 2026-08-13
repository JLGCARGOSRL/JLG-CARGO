import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const bucketName = "customer-documents";

function createAuthorizedClient(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase public configuration is incomplete.");
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

function storagePath(filePath: unknown, fileUrl: unknown) {
  if (typeof filePath === "string" && filePath.trim()) {
    return filePath.trim().replace(/^\/+/, "");
  }
  if (typeof fileUrl !== "string" || !fileUrl.trim()) return null;

  const value = fileUrl.trim();
  const marker = `/storage/v1/object/public/${bucketName}/`;
  const markerIndex = value.indexOf(marker);
  if (markerIndex >= 0) {
    return decodeURIComponent(value.slice(markerIndex + marker.length));
  }
  return value.startsWith("http") ? null : value.replace(/^\/+/, "");
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/customers/[id]/documents/[documentId]">
) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";
    if (!token) {
      return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
    }

    const supabase = createAuthorizedClient(token);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("system_user_profiles")
      .select("is_active")
      .eq("id", user.id)
      .single();
    if (!profile?.is_active) {
      return NextResponse.json({ error: "Usuario sin acceso." }, { status: 403 });
    }

    const { id, documentId } = await context.params;
    const { data: document, error: documentError } = await supabase
      .from("customer_documents")
      .select("id, file_path, file_url")
      .eq("id", documentId)
      .eq("customer_id", id)
      .single();
    if (documentError || !document) {
      return NextResponse.json(
        { error: "El documento no existe en este expediente." },
        { status: 404 }
      );
    }

    const path = storagePath(document.file_path, document.file_url);
    if (path) {
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([path]);
      if (storageError) {
        return NextResponse.json(
          { error: "No se pudo eliminar el PDF del almacenamiento." },
          { status: 500 }
        );
      }
    }

    const { error: deleteError } = await supabase
      .from("customer_documents")
      .delete()
      .eq("id", documentId)
      .eq("customer_id", id);
    if (deleteError) {
      return NextResponse.json(
        { error: "El PDF se eliminó, pero no se pudo retirar su registro." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Customer document deletion failed", error);
    return NextResponse.json(
      { error: "No se pudo eliminar el documento." },
      { status: 500 }
    );
  }
}
