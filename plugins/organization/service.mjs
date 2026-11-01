import {randomUUID} from 'node:crypto';
import {requireThat} from '../../apps/control-api/src/errors.mjs';
const department=r=>({id:r.id,name:r.name,parentId:r.parent_id??'',active:r.active,revision:r.revision});
export async function memberDTO(db,id){const p=(await db.query('SELECT p.*,m.revision FROM product_members m JOIN principals p ON p.id=m.principal_id WHERE p.id=$1',[id])).rows[0];requireThat(p,404,'NOT_FOUND');return {principalId:p.id,name:p.name,kind:p.kind,active:p.active,departmentIds:(await db.query('SELECT department_id FROM product_memberships WHERE principal_id=$1 ORDER BY department_id',[id])).rows.map(r=>r.department_id),revision:p.revision};}
export class OrganizationService {
 constructor(kernel){this.kernel=kernel;}
 async memberships(db,id,departments){
  requireThat(new Set(departments).size===departments.length,400,'INVALID_INPUT');
  for(const d of departments)requireThat((await db.query('SELECT 1 FROM product_departments WHERE id=$1 AND active',[d])).rowCount,404,'NOT_FOUND');
  await db.query('DELETE FROM product_memberships WHERE principal_id=$1',[id]);
  for(const d of departments)await db.query('INSERT INTO product_memberships(principal_id,department_id) VALUES($1,$2)',[id,d]);
 }
 async dispatch(db,ctx,id,i){
  if(id==='organization.departments.list.v1'){
   const rows=(await db.query('SELECT * FROM product_departments WHERE id>$1 ORDER BY id LIMIT 101',[i.after??''])).rows;
   return {items:rows.slice(0,100).map(department),...(rows.length>100&&{nextCursor:rows[99].id})};
  }
  if(id==='organization.departments.create.v1'||id==='organization.departments.update.v1'){
   requireThat(i.name.trim().length>0,400,'INVALID_INPUT');
   if(i.parentId)requireThat((await db.query('SELECT 1 FROM product_departments WHERE id=$1 AND active',[i.parentId])).rowCount,404,'NOT_FOUND');
   if(id.endsWith('create.v1')){
    const row=(await db.query('INSERT INTO product_departments(id,name,parent_id) VALUES($1,$2,$3) RETURNING *',[randomUUID(),i.name,i.parentId||null])).rows[0];await this.kernel.event(db,'organization.department.changed.v1',row.id);return department(row);
   }
   const old=(await db.query('SELECT * FROM product_departments WHERE id=$1',[i.departmentId])).rows[0];requireThat(old,404,'NOT_FOUND');requireThat(old.revision===i.expectedRevision,409,'VERSION_CONFLICT');
   let parent=i.parentId;const seen=new Set([i.departmentId]);while(parent){requireThat(!seen.has(parent),409,'DEPARTMENT_CYCLE');seen.add(parent);parent=(await db.query('SELECT parent_id FROM product_departments WHERE id=$1',[parent])).rows[0]?.parent_id;}
   if(!i.active){requireThat(!(await db.query('SELECT 1 FROM product_memberships WHERE department_id=$1 UNION ALL SELECT 1 FROM product_departments WHERE parent_id=$1 AND active LIMIT 1',[old.id])).rowCount,409,'DEPARTMENT_IN_USE');}
   const row=(await db.query('UPDATE product_departments SET name=$2,parent_id=$3,active=$4,revision=revision+1 WHERE id=$1 RETURNING *',[old.id,i.name,i.parentId||null,i.active])).rows[0];await this.kernel.event(db,'organization.department.changed.v1',row.id);return department(row);
  }
  if(id==='organization.members.list.v1'){
   const rows=(await db.query('SELECT principal_id FROM product_members WHERE principal_id>$1 ORDER BY principal_id LIMIT 101',[i.after??''])).rows;
   return {items:await Promise.all(rows.slice(0,100).map(r=>memberDTO(db,r.principal_id))),...(rows.length>100&&{nextCursor:rows[99].principal_id})};
  }
  if(id==='organization.members.create.v1'){
   requireThat(i.name.trim().length>0,400,'INVALID_INPUT');const principalId=randomUUID();
   await db.query("INSERT INTO principals(id,name,kind,role) VALUES($1,$2,$3,'member')",[principalId,i.name,i.kind]);
   await db.query('INSERT INTO product_members(principal_id) VALUES($1)',[principalId]);await this.memberships(db,principalId,i.departmentIds);await this.kernel.event(db,'organization.membership.changed.v1',principalId);return memberDTO(db,principalId);
  }
  if(id==='organization.members.update.v1'){
   requireThat(i.principalId!==ctx.actor.id);const old=await memberDTO(db,i.principalId);requireThat(old.revision===i.expectedRevision,409,'VERSION_CONFLICT');
   await this.memberships(db,i.principalId,i.departmentIds);
   await db.query('UPDATE principals SET active=$2,epoch=epoch+CASE WHEN active<>$2 THEN 1 ELSE 0 END WHERE id=$1',[i.principalId,i.active]);
   await db.query('UPDATE product_members SET revision=revision+1 WHERE principal_id=$1',[i.principalId]);await this.kernel.event(db,i.active?'organization.membership.changed.v1':'organization.person.disabled.v1',i.principalId);return memberDTO(db,i.principalId);
  }
  requireThat(false,404,'NOT_FOUND');
 }
}
