import { z } from 'zod';
import { channel, listItemSchema, money, uuid } from './domain.js';

export const authCredentials=z.object({email:z.email().max(254),password:z.string().min(10).max(200)}).strict();
export const signupSchema=authCredentials.extend({display_name:z.string().trim().min(1).max(100)});
export const refreshSchema=z.object({refresh_token:z.string().min(10).max(5000)}).strict();
export const resetSchema=z.object({email:z.email().max(254)}).strict();
export const passwordSchema=z.object({password:z.string().min(10).max(200)}).strict();
export const profileSchema=z.object({display_name:z.string().trim().max(100).optional(),account_type:z.enum(['customer','business_buyer']).optional(),district:z.string().max(80).optional(),locale:z.enum(['uz','ru','en']).optional()}).strict();
export const sellerSchema=z.object({name:z.string().trim().min(1).max(160),legal_name:z.string().max(200).default(''),tax_id:z.string().max(30).default(''),business_phone:z.string().max(40).default(''),website:z.union([z.url().regex(/^https?:\/\//),z.literal('')]).default('')}).strict();
export const branchSchema=z.object({seller_id:uuid,name:z.string().trim().min(1).max(160),district:z.string().trim().min(1).max(80),address:z.string().max(400).default(''),delivery_fee_uzs:money.nullable().default(null),minimum_order_uzs:money.default(0)}).strict();
export const tierSchema=z.object({min_packs:z.number().int().min(1).max(1_000_000),price_uzs:money.positive()}).strict();
export const offerWriteSchema=z.object({branch_id:uuid,variant_id:uuid,channel,price_uzs:money.positive(),min_packs:z.number().int().min(1).max(1_000_000).default(1),step_packs:z.number().int().min(1).max(1_000_000).default(1),available_packs:z.number().int().min(0).max(1_000_000_000).nullable().default(null),availability:z.enum(['available','limited','unavailable']).default('available'),quantity_tiers:z.array(tierSchema).max(20).default([]),conditions:z.string().max(1000).default(''),source_url:z.url().regex(/^https?:\/\//).nullable().default(null),valid_until:z.iso.datetime({offset:true})}).strict().superRefine((o,ctx)=>{
 if(new Set(o.quantity_tiers.map(t=>t.min_packs)).size!==o.quantity_tiers.length) ctx.addIssue({code:'custom',message:'Tier thresholds must be unique.',path:['quantity_tiers']});
});
export const offerPatchSchema=z.object({price_uzs:money.positive().optional(),min_packs:z.number().int().min(1).max(1_000_000).optional(),step_packs:z.number().int().min(1).max(1_000_000).optional(),available_packs:z.number().int().min(0).max(1_000_000_000).nullable().optional(),availability:z.enum(['available','limited','unavailable']).optional(),quantity_tiers:z.array(tierSchema).max(20).optional(),conditions:z.string().max(1000).optional(),source_url:z.url().regex(/^https?:\/\//).nullable().optional(),valid_until:z.iso.datetime({offset:true}),status:z.enum(['published','withdrawn']).optional()}).strict();
export const savedListSchema=z.object({id:uuid.optional(),name:z.string().trim().min(1).max(120),channel,district:z.string().max(80).optional(),items:z.array(listItemSchema).min(1).max(30)}).strict().superRefine((l,ctx)=>{
 if(new Set(l.items.map(i=>i.product_id)).size!==l.items.length) ctx.addIssue({code:'custom',message:'Duplicate products.',path:['items']});
});
export const alertSchema=z.object({product_id:uuid,channel,district:z.string().trim().min(1).max(80),target_unit_price_uzs:z.number().positive().max(1e12),include_demo:z.boolean().default(false)}).strict();
export const reportSchema=z.object({offer_id:uuid,reason:z.string().trim().min(5).max(1000)}).strict();
export const categorySchema=z.object({slug:z.string().regex(/^[a-z0-9-]{1,80}$/),name_uz:z.string().min(1).max(100),name_ru:z.string().min(1).max(100),name_en:z.string().min(1).max(100),sort_order:z.number().int().min(0).max(1000).default(0)}).strict();
export const productSchema=z.object({category_id:uuid,name:z.string().trim().min(1).max(200),brand:z.string().max(100).default(''),grade:z.string().max(100).default(''),origin:z.string().max(100).default(''),base_unit:z.enum(['kg','L','unit'])}).strict();
export const variantSchema=z.object({product_id:uuid,name:z.string().min(1).max(160),pack_quantity:z.number().min(0.000001).max(1_000_000),barcode:z.string().max(32).nullable().default(null)}).strict();
