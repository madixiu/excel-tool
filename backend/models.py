from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class Formula(BaseModel):
    name: str
    func: str
    args: List[str]


FilterOp = Literal[
    "==", "!=", ">", ">=", "<", "<=",
    "contains", "starts_with", "ends_with",
    "is_empty", "is_not_empty",
]


class FilterRule(BaseModel):
    column: str
    op: FilterOp
    value: Optional[str] = ""
    connector: Literal["AND", "OR"] = "AND"


class ProcessRequest(BaseModel):
    formulas: List[Formula]
    filter_rules: List[FilterRule] = []
    filter_expr: str = ""
    place: str = "front"


class ColumnInfo(BaseModel):
    letter: str
    original_header: str


class InspectResponse(BaseModel):
    filename: str
    rows: int
    columns: int
    column_map: List[ColumnInfo]