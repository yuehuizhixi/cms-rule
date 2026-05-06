import axios from 'axios';

const client = axios.create({ baseURL: 'http://localhost:8080/api/rule-engine' });

export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

export interface GroupDTO {
  id: string;
  name: string;
  tabOrder?: number;
  createdAt?: string;
}

export interface RuleDTO {
  id: string;
  groupId: string;
  name: string;
  description?: string;
  status: string;
  pollInterval: number;
  flow?: string;
  createdAt?: string;
  updatedAt?: string;
}

// GET /groups
export async function getGroups(): Promise<ApiResponse<{ groups: GroupDTO[]; rules: RuleDTO[] }>> {
  const res = await client.get('/groups');
  return res.data;
}

// POST /groups
export async function createGroup(name: string): Promise<ApiResponse<GroupDTO>> {
  const res = await client.post('/groups', { name });
  return res.data;
}

// PUT /groups/:groupId
export async function updateGroup(groupId: string, name: string): Promise<ApiResponse<GroupDTO>> {
  const res = await client.put(`/groups/${groupId}`, { name });
  return res.data;
}

// DELETE /groups/:groupId
export async function deleteGroup(groupId: string): Promise<ApiResponse<void>> {
  const res = await client.delete(`/groups/${groupId}`);
  return res.data;
}

// POST /rules
export async function createRule(data: { groupId: string; name: string; description?: string; pollInterval: number }): Promise<ApiResponse<RuleDTO>> {
  const res = await client.post('/rules', data);
  return res.data;
}

// PUT /rules/:ruleId
export async function updateRule(ruleId: string, data: { name: string; description?: string; pollInterval: number }): Promise<ApiResponse<RuleDTO>> {
  const res = await client.put(`/rules/${ruleId}`, data);
  return res.data;
}

// DELETE /rules/:ruleId
export async function deleteRule(ruleId: string): Promise<ApiResponse<void>> {
  const res = await client.delete(`/rules/${ruleId}`);
  return res.data;
}

// PATCH /rules/:ruleId/status
export async function updateRuleStatus(ruleId: string, status: 'ACTIVE' | 'INACTIVE' | 'DRAFT'): Promise<ApiResponse<RuleDTO>> {
  const res = await client.patch(`/rules/${ruleId}/status`, { status });
  return res.data;
}

// PUT /rules/:ruleId/flow
export async function saveRuleFlow(ruleId: string, flowJson: string, draft = false): Promise<ApiResponse<RuleDTO>> {
  const url = draft ? `/rules/${ruleId}/flow/draft` : `/rules/${ruleId}/flow`;
  const res = await client.put(url, { flow: flowJson });
  return res.data;
}

// DELETE /rules/batch
export async function batchDeleteRules(ruleIds: string[]): Promise<ApiResponse<void>> {
  const res = await client.delete('/rules/batch', { data: { ruleIds } });
  return res.data;
}

// POST /rules/import
export async function importRule(targetGroupId: string, payload: { name: string; description?: string; pollInterval: number; flow: string }): Promise<ApiResponse<number>> {
  // The backend expects an array wrapped in JSON string
  const body = JSON.stringify([{
    name: payload.name,
    description: payload.description || '',
    pollInterval: payload.pollInterval,
    flow: JSON.parse(payload.flow || '{"nodes":{},"mainFlow":[]}')
  }]);
  const res = await client.post(`/rules/import?targetGroupId=${targetGroupId}`, body, {
    headers: { 'Content-Type': 'application/json' }
  });
  return res.data;
}

// GET /logs
export async function getLogs(params: { ruleId?: string; level?: string; since?: string; until?: string; limit?: number }): Promise<ApiResponse<{ items: any[] }>> {
  const res = await client.get('/logs', { params });
  return res.data;
}

// POST /rules/:ruleId/execute — manual execution
export async function executeRuleManually(ruleId: string): Promise<ApiResponse<any>> {
  const res = await client.post(`/rules/${ruleId}/execute`);
  return res.data;
}

// GET /parameters
export async function getParameters(): Promise<ApiResponse<any[]>> {
  const res = await client.get('/parameters');
  return res.data;
}

// GET /parameters/last-values
export async function getParameterLastValues(): Promise<ApiResponse<any[]>> {
  const res = await client.get('/parameters/last-values');
  return res.data;
}

// ========== 参数选择代理接口 (proxy to real microservices) ==========

const proxyClient = axios.create({ baseURL: 'http://localhost:8080/api/rule-engine/proxy' });

// 能源类型
// POST /api/cms-cloud-service/energyInfo/queryCache
// → /proxy/energyInfo/queryCache
export async function proxyEnergyQueryCache(body = {}): Promise<any> {
  const res = await proxyClient.post('/energyInfo/queryCache', body);
  return res.data;
}

// 位置树查询
// POST /api/cms-cloud-service/locationTree/query
// → /proxy/locationTree/query
export async function proxyLocationTreeQuery(body: Record<string, any>): Promise<any> {
  const res = await proxyClient.post('/locationTree/query', body);
  return res.data;
}

// 设备参数列表（分页）
// POST /api/hvac_iot/jnyz/dataset/queryParams
// → /proxy/jnyz/dataset/queryParams
export async function proxyQueryParams(body: Record<string, any>): Promise<any> {
  const res = await proxyClient.post('/jnyz/dataset/queryParams', body);
  return res.data;
}

// 绑定关系查询（结构树）
// POST /api/cms-cloud-service/projectModel/queryBindRelationAll
// → /proxy/projectModel/queryBindRelationAll
export async function proxyQueryBindRelationAll(body: Record<string, any>): Promise<any> {
  const res = await proxyClient.post('/projectModel/queryBindRelationAll', body);
  return res.data;
}
