import { useEffect, useState } from "react";

export default function DataHealthPage() {
  const [issues, setIssues] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    fetch("/api/research/data-quality")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setIssues(data.data);
      });
  }, []);

  return (
    <section className="workbench-section">
      <div className="section-heading">
        <h1>数据健康</h1>
        <p>查看行情缺失、异常价格和数据源失败记录。</p>
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>检查</th>
              <th>级别</th>
              <th>股票</th>
              <th>信息</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue, index) => (
              <tr key={index}>
                <td>{String(issue.date || "-")}</td>
                <td>{String(issue.check_name || "-")}</td>
                <td>
                  <span className="pill">{String(issue.severity || "-")}</span>
                </td>
                <td>{String(issue.symbol || "-")}</td>
                <td>{String(issue.message || "-")}</td>
              </tr>
            ))}
            {issues.length === 0 && (
              <tr>
                <td colSpan={5}>暂无数据质量记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
