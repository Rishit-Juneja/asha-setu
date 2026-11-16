import asyncio
import contextlib

import websockets
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from ..config import settings
from ..security import decode_token

router = APIRouter()

_ws_lock = asyncio.Lock()


@router.websocket("/ws/stt")
async def stt_proxy(
    websocket: WebSocket,
    token: str = Query(...),
    language: str = Query("kn-IN"),
    model: str | None = Query(None),
    format: str | None = Query(None),
) -> None:
    try:
        decode_token(token)
    except Exception:
        await websocket.close(code=4401)
        return

    if _ws_lock.locked():
        await websocket.close(code=4429)
        return

    async with _ws_lock:
        await websocket.accept()
        headers = {
            "x-api-key-id": settings.gnani_api_key,
            "x-model": model or settings.gnani_stt_model,
            "lang_code": language,
            "x-sample-rate": "16000",
        }
        if format:
            headers["x-format"] = format

        try:
            async with websockets.connect(
                settings.gnani_stt_ws,
                additional_headers=headers,
                max_size=None,
                ping_interval=20,
            ) as upstream:

                async def client_to_upstream() -> None:
                    while True:
                        message = await websocket.receive()
                        if message["type"] == "websocket.disconnect":
                            return
                        if message.get("bytes") is not None:
                            await upstream.send(message["bytes"])
                        elif message.get("text") is not None:
                            await upstream.send(message["text"])

                async def upstream_to_client() -> None:
                    async for message in upstream:
                        if isinstance(message, bytes):
                            await websocket.send_bytes(message)
                        else:
                            await websocket.send_text(message)

                tasks = [
                    asyncio.create_task(client_to_upstream()),
                    asyncio.create_task(upstream_to_client()),
                ]
                done, pending = await asyncio.wait(
                    tasks, return_when=asyncio.FIRST_COMPLETED
                )
                for task in pending:
                    task.cancel()
                for task in done:
                    with contextlib.suppress(Exception):
                        task.result()
        except WebSocketDisconnect:
            pass
        except Exception as exc:
            with contextlib.suppress(Exception):
                await websocket.send_json({"type": "error", "message": str(exc)})
        finally:
            with contextlib.suppress(Exception):
                await websocket.close()
