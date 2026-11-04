import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../components/AdminLayout";
import { Icon, EmptyState, DataNotice, RefreshButton, StatusBadge } from "../components/AdminUI";
import { fetchOrders } from "../services/api";
import { buildAnalytics, formatNumber, formatDate, money } from "../utils/adminData";
import useAdminData from "./useAdminData";
const EVENTS = ["order:new", "order:updated"];
function Chart({ days, metric, label, unit, total, empty }) {
  const highest = Math.max(...days.map(day => day[metric]), 1);
  const max = metric === "orders" ? Math.max(2, Math.ceil(highest / 2) * 2) : highest;
  return <section className="pos-panel pos-chart-panel"><div className="pos-panel-heading"><div><h2>{label}</h2><p>Акыркы 7 күн</p></div><span className="pos-chart-key"><i />{unit}</span></div>
    <div className="pos-chart-total">{formatNumber(total)}<small>{unit}</small></div>
    {empty ? <EmptyState icon="chart" detail="Бул мезгилде заказ катталган эмес." /> : <><div className="pos-chart" role="img" aria-label={label + ": " + days.map(day => day.label + " — " + formatNumber(day[metric]) + " " + unit).join(", ")}><div className="pos-chart-y"><span>{formatNumber(max)}</span><span>{formatNumber(max / 2)}</span><span>0</span></div><div className="pos-chart-plot"><div className="pos-chart-grid"><i /><i /><i /></div><div className="pos-chart-bars">{days.map(day => <div className="pos-chart-column" key={day.key}><div className="pos-chart-bar-space"><div className={"pos-chart-bar" + (metric === "revenue" ? " pos-chart-bar--revenue" : "")} style={{ height: (day[metric] / max * 100) + "%" }} title={day.label + ": " + formatNumber(day[metric]) + " " + unit} /><span className="pos-chart-tooltip">{formatNumber(day[metric])}</span></div><span>{day.label}</span></div>)}</div></div></div><details className="pos-chart-data"><summary>Күндөр боюнча маалымат</summary><dl>{days.map(day => <div key={day.key}><dt>{day.label}</dt><dd>{formatNumber(day[metric])} {unit}</dd></div>)}</dl></details></>}
  </section>;
}
export default function AdminDashboard() {
  const { data: orders, loading, error, load } = useAdminData(fetchOrders, EVENTS);
  const data = useMemo(() => orders ? buildAnalytics(orders) : null, [orders]);
  const cards = data ? [["Бүгүнкү заказдар", data.todayOrders, "orders", "Бүгүн катталган"], ["Бүгүнкү киреше", money(data.todayRevenue), "money", "Жокко чыгарылгандарсыз"], ["Күтүлүүдө", data.statuses.pending, "clock", "Бардык заказдар"], ["Даярдалууда", data.statuses.preparing, "kitchen", "Бардык заказдар"], ["Даяр", data.statuses.ready, "check", "Бардык заказдар"], ["Берилди", data.statuses.served, "waiter", "Бардык заказдар"]] : [];
  return <AdminLayout title="Башкаруу панели" subtitle="Рестораныңыздын бүгүнкү иши — бир көрүнүштө." actions={<RefreshButton loading={loading} onClick={load} />}>
    <DataNotice loading={loading} error={error} onRetry={load} />
    {data && <><div className="pos-section-caption"><span>Бүгүнкү көрсөткүчтөр</span><span>API маалыматтары боюнча</span></div><div className="pos-stats">{cards.map(([label, value, icon, note], index) => <article className={"pos-stat" + (index === 1 ? " pos-stat--accent" : "")} key={label}><div className="pos-stat-top"><span>{label}</span><span className="pos-stat-icon"><Icon name={icon} /></span></div><strong>{typeof value === "number" ? formatNumber(value) : value}</strong><small>{note}</small></article>)}</div>
    <div className="pos-analytics-grid"><Chart days={data.days} metric="orders" label="Заказдардын динамикасы" total={data.weeklyOrders} unit="заказ" empty={!data.weeklyOrders} /><Chart days={data.days} metric="revenue" label="Кирешенин динамикасы" total={data.weeklyRevenue} unit="сом" empty={!data.weeklyOrders} /></div>
    <p className="pos-metric-note">Киреше — жокко чыгарылбаган заказдардын суммасы. Төлөмдүн кабыл алынганы өзүнчө төлөм статусунда көрсөтүлөт.</p>
    <div className="pos-bottom-grid"><section className="pos-panel"><div className="pos-panel-heading"><div><h2>Популярдуу товарлар</h2><p>Жокко чыгарылбаган бардык заказдар</p></div><Icon name="products" /></div>{data.popular.length ? <ol className="pos-ranking">{data.popular.map((item, i) => <li key={item.name}><span className="pos-rank-number">{String(i + 1).padStart(2, "0")}</span><div className="pos-rank-info"><strong>{item.name}</strong><div className="pos-rank-track"><span style={{ width: (item.qty / data.popular[0].qty * 100) + "%" }} /></div></div><span className="pos-rank-qty">{formatNumber(item.qty)}<small>даана</small></span></li>)}</ol> : <EmptyState icon="products" />}</section>
    <section className="pos-panel"><div className="pos-panel-heading"><div><h2>Акыркы заказдар</h2><p>Эң жаңы 5 заказ</p></div><Link className="pos-text-link" to="/admin/orders">Баары<Icon name="arrow" size={16} /></Link></div>{orders.length ? <div className="pos-recent-list">{[...orders].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0,5).map(order => <div className="pos-recent" key={order._id}><span className="pos-table-icon"><Icon name="table" /></span><div><strong>Стол №{order.tableNumber}</strong><small>{formatDate(order.createdAt)}</small></div><div className="pos-recent-end"><strong>{money(order.totalAmount)}</strong><StatusBadge status={order.status} /></div></div>)}</div> : <EmptyState />}</section></div></>}
  </AdminLayout>;
}
