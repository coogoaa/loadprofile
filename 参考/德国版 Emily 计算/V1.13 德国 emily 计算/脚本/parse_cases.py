"""
解析 cases.md 中的 ```tsv ... ``` 区块为结构化 case 列表。
用法：
    python3 parse_cases.py ../配置/cases.md             # 仅打印
    python3 parse_cases.py ../配置/cases.md --json out.json
"""
import argparse
import json
import re
import sys
from pathlib import Path

VALID_MODE  = {'R', 'N', 'RN'}
VALID_TIER  = {'A', 'B', 'C'}
VALID_Q1    = {'under5', '5-10', '10-15', '15-20', '20+', '-', ''}
VALID_Q2    = {'no_system', 'air_con', 'heat_pump', 'electric_heat', '-', ''}
VALID_Q3    = {'low', 'medium', 'high', 'very_high', '-', ''}
VALID_Q5    = {'mostly_overnight', 'mixed_day_and_night', 'mostly_daytime', 'solar_optimized', '-', ''}


def _norm(v):
    """空 / '-' → None，否则原值（字符串）。"""
    if v is None:
        return None
    s = str(v).strip()
    if s in ('', '-'):
        return None
    return s


def _to_int(v, default=0):
    s = _norm(v)
    if s is None:
        return default
    try:
        return int(float(s))
    except (TypeError, ValueError):
        return default


def _to_float(v, default=None):
    s = _norm(v)
    if s is None:
        return default
    try:
        return float(s)
    except (TypeError, ValueError):
        return default


def extract_tsv_blocks(md_text):
    """提取所有 ```tsv ... ``` 代码块内容（合并）。"""
    blocks = re.findall(r'```tsv\s*\n(.*?)```', md_text, re.DOTALL | re.IGNORECASE)
    if not blocks:
        raise ValueError('未找到 ```tsv 代码块，请检查 cases.md')
    return '\n'.join(blocks)


def parse_tsv(tsv_text):
    """按 TAB 分割，首行为表头。空行忽略。"""
    rows = []
    header = None
    for raw_line in tsv_text.splitlines():
        line = raw_line.rstrip('\r')
        if not line.strip():
            continue
        cells = line.split('\t')
        # 去除单元格前后空白
        cells = [c.strip() for c in cells]
        if header is None:
            header = cells
            continue
        # 行长度补齐
        while len(cells) < len(header):
            cells.append('')
        row = dict(zip(header, cells))
        rows.append(row)
    if not rows:
        raise ValueError('TSV 代码块只有表头，没有数据行')
    return rows


def validate_and_normalize(row, lineno):
    """逐字段校验 + 归一化，返回 case dict 或抛 ValueError。"""
    errors = []

    case_id = _norm(row.get('case_id'))
    if not case_id or not case_id.isdigit():
        errors.append(f'case_id 必填且为数字，得到: {row.get("case_id")!r}')

    mode = _norm(row.get('mode'))
    if mode not in VALID_MODE:
        errors.append(f'mode 须为 R/N/RN，得到: {mode!r}')

    tier = _norm(row.get('tier'))
    if tier not in VALID_TIER:
        errors.append(f'tier 须为 A/B/C，得到: {tier!r}')

    q1 = (_norm(row.get('Q1_existing_pv')) or '-')
    if q1 not in VALID_Q1 and q1 != '-':
        errors.append(f'Q1_existing_pv 取值非法: {q1!r}')

    q2 = (_norm(row.get('Q2_hvac')) or '-')
    if q2 not in VALID_Q2 and q2 != '-':
        errors.append(f'Q2_hvac 取值非法: {q2!r}')

    q3 = (_norm(row.get('Q3_usage')) or '-')
    if q3 not in VALID_Q3 and q3 != '-':
        errors.append(f'Q3_usage 取值非法: {q3!r}')

    q4_km = _to_int(row.get('Q4_ev_km'), default=0)
    if q4_km < 0:
        errors.append(f'Q4_ev_km 不能为负: {q4_km}')

    q5 = (_norm(row.get('Q5_ev_time')) or '-')
    if q5 not in VALID_Q5 and q5 != '-':
        errors.append(f'Q5_ev_time 取值非法: {q5!r}')

    sam3d = _to_float(row.get('sam3d_kwp'), default=None)

    note = _norm(row.get('备注')) or ''

    if errors:
        raise ValueError(f'第 {lineno} 行 case_id={case_id}: ' + '; '.join(errors))

    return {
        'case_id':         case_id,
        'mode':            mode,
        'tier':            tier,
        'Q1_existing_pv':  q1,
        'Q2_hvac':         q2 if q2 != '-' else '-',
        'Q3_usage':        q3 if q3 != '-' else '-',
        'Q4_ev_km':        q4_km,
        'Q5_ev_time':      q5 if q5 != '-' else '-',
        'sam3d_kwp':       sam3d,
        'note':            note,
    }


def parse_cases_md(md_path):
    md_text = Path(md_path).read_text(encoding='utf-8')
    tsv_text = extract_tsv_blocks(md_text)
    rows = parse_tsv(tsv_text)

    cases = []
    errors = []
    for i, row in enumerate(rows, start=2):
        try:
            cases.append(validate_and_normalize(row, lineno=i))
        except ValueError as e:
            errors.append(str(e))

    if errors:
        raise ValueError('cases.md 校验失败:\n  - ' + '\n  - '.join(errors))

    return cases


def main():
    parser = argparse.ArgumentParser(description='解析 cases.md → case 列表')
    parser.add_argument('md_path', help='cases.md 路径')
    parser.add_argument('--json', help='输出 cases.json 路径（可选）')
    args = parser.parse_args()

    try:
        cases = parse_cases_md(args.md_path)
    except ValueError as e:
        print('❌', e, file=sys.stderr)
        sys.exit(1)

    print(f'✓ 解析成功，共 {len(cases)} 个 case：')
    for c in cases:
        print(f'  [{c["case_id"]}] mode={c["mode"]} tier={c["tier"]} '
              f'Q1={c["Q1_existing_pv"]} Q2={c["Q2_hvac"]} Q3={c["Q3_usage"]} '
              f'Q4={c["Q4_ev_km"]}km Q5={c["Q5_ev_time"]} '
              f'sam3d={c["sam3d_kwp"]} | {c["note"]}')

    if args.json:
        Path(args.json).write_text(
            json.dumps(cases, ensure_ascii=False, indent=2), encoding='utf-8'
        )
        print(f'✓ 已写入: {args.json}')


if __name__ == '__main__':
    main()
