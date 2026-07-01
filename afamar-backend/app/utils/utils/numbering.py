import re


def generate_budget_number(last_number: str | None) -> str:
    """Generate budget number: P-000001, P-000002, etc."""
    return _generate_number("P", last_number)


def generate_work_order_number(last_number: str | None) -> str:
    """Generate work order number: A-000001, A-000002, etc."""
    return _generate_number("A", last_number)


def _generate_number(prefix: str, last_number: str | None) -> str:
    if not last_number:
        return f"{prefix}-000001"
    match = re.search(r"(\d+)$", last_number)
    if not match:
        return f"{prefix}-000001"
    next_num = int(match.group(1)) + 1
    return f"{prefix}-{next_num:06d}"
