from fastapi.testclient import TestClient


def test_task_center_routes_list_cancel_and_retry(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.schemas import AnalyzeRequest, TaskProgress, TaskStatus
    from tradingagents.api.server import create_app
    from tradingagents.api.task_manager import TaskManager

    manager = TaskManager.get_instance()
    manager._tasks = {}
    manager._reports = {}
    manager._task_requests = {}
    manager._cancelled_tasks = set()

    request = AnalyzeRequest(ticker="NVDA", trade_date="2026-05-16")
    manager._tasks["task-1"] = TaskProgress(
        task_id="task-1",
        status=TaskStatus.FAILED,
        ticker="NVDA",
        trade_date="2026-05-16",
        research_depth="medium",
        current_step="分析失败",
    )
    manager._task_requests["task-1"] = request

    monkeypatch.setattr(manager, "create_task", lambda retry_request: "task-retry")

    client = TestClient(create_app())

    listed = client.get("/api/tasks")
    assert listed.status_code == 200
    assert listed.json()["data"]["tasks"][0]["task_id"] == "task-1"

    cancelled = client.post("/api/tasks/task-1/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["data"]["status"] == "cancelled"

    retried = client.post("/api/tasks/task-1/retry")
    assert retried.status_code == 200
    assert retried.json()["data"]["task_id"] == "task-retry"


def test_task_manager_extracts_sanitized_tool_events():
    from tradingagents.api.task_manager import TaskManager

    class ToolCallMessage:
        name = "assistant"
        tool_calls = [
            {
                "id": "call-1",
                "name": "get_stock_data",
                "args": {
                    "symbol": "600519.SH",
                    "api_key": "should-not-leak",
                    "date": "2026-05-12",
                },
            }
        ]

    class ToolResultMessage:
        name = "get_stock_data"
        tool_call_id = "call-1"
        content = "loaded 130 rows"

    manager = TaskManager.get_instance()
    events = manager._extract_tool_events({"messages": [ToolCallMessage(), ToolResultMessage()]})

    assert events[0]["tool_name"] == "get_stock_data"
    assert events[0]["args"]["api_key"] == "***"
    assert events[1]["event_type"] == "tool_result"
    assert events[1]["content_preview"] == "loaded 130 rows"
