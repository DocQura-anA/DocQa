import { db } from '@/db';
import { SendMessageValidator } from '@/lib/validators/SendMessageValidator';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export const POST = async (req: NextRequest) => {
  const body = await req.json();
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id: userId } = user;

  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { fileId, message } = SendMessageValidator.parse(body);

  const file = await db.file.findFirst({
    where: {
      id: fileId,
      userId,
    },
  });

  if (!file) {
    return new Response('File not found', { status: 404 });
  }

  await db.message.create({
    data: {
      text: message,
      isUserMessage: true,
      userId,
      fileId,
    },
  });

  const prevMessages = await db.message.findMany({
    where: {
      fileId,
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: 6,
  });

  const formattedMessages = prevMessages.map((message) => ({
    role: message.isUserMessage ? 'user' : 'assistant',
    content: message.text,
  }));
  const data = {
    query: message,
    document_id: file.url,
    // context_window: '',
  };
  console.log(data);
  const res = await fetch('http://localhost:8000/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (res.status !== 200) {
    return new Response('Failed to send message', { status: 500 });
  }

  const { response, relevant_documents } = await res.json();
  console.log(response);

  await db.message.create({
    data: {
      text: response,
      isUserMessage: false,
      userId,
      fileId,
    },
  });

  return new NextResponse(response);
};
