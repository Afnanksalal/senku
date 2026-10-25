import { Body,Controller,Delete,Get,Headers,Param,Patch,Post,Req } from '@nestjs/common';
import { ApiBearerAuth,ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiRequest,Roles,SchemaBody,actor,uuid } from '../common/http';
import { MolecularService } from './molecular.service';
import { collectionInput,collectionPatch,compoundInput,compoundPatch,screenInput,molecularLimits } from './molecular.schemas';
@ApiTags('Molecular workspace') @ApiBearerAuth() @Roles('learner','teacher','admin') @Controller('v1/molecular')
export class MolecularController{
 constructor(private readonly molecular:MolecularService){}
 @Get('limits')limits(){return molecularLimits;}
 @Get('collections')list(@Req()r:ApiRequest){return this.molecular.list(actor(r));}
 @Post('collections') @SchemaBody(collectionInput)create(@Req()r:ApiRequest,@Headers('idempotency-key')key:string|undefined,@Body()b:z.infer<typeof collectionInput>){return this.molecular.create(actor(r),key,b);}
 @Get('collections/:id')collection(@Req()r:ApiRequest,@Param('id')id:string){return this.molecular.collection(actor(r),uuid(id));}
 @Patch('collections/:id') @SchemaBody(collectionPatch)patch(@Req()r:ApiRequest,@Param('id')id:string,@Body()b:z.infer<typeof collectionPatch>){return this.molecular.rename(actor(r),uuid(id),b);}
 @Delete('collections/:id')remove(@Req()r:ApiRequest,@Param('id')id:string){return this.molecular.removeCollection(actor(r),uuid(id));}
 @Post('collections/:id/compounds') @SchemaBody(compoundInput)add(@Req()r:ApiRequest,@Param('id')id:string,@Headers('idempotency-key')key:string|undefined,@Body()b:z.infer<typeof compoundInput>){return this.molecular.addCompound(actor(r),uuid(id),key,b);}
 @Patch('collections/:id/compounds/:compound') @SchemaBody(compoundPatch)update(@Req()r:ApiRequest,@Param('id')id:string,@Param('compound')compound:string,@Body()b:z.infer<typeof compoundPatch>){return this.molecular.updateCompound(actor(r),uuid(id),uuid(compound),b);}
 @Delete('collections/:id/compounds/:compound')deleteCompound(@Req()r:ApiRequest,@Param('id')id:string,@Param('compound')compound:string){return this.molecular.removeCompound(actor(r),uuid(id),uuid(compound));}
 @Get('screens')screens(@Req()r:ApiRequest){return this.molecular.screens(actor(r));}
 @Post('screens') @SchemaBody(screenInput)screen(@Req()r:ApiRequest,@Headers('idempotency-key')key:string|undefined,@Body()b:z.infer<typeof screenInput>){return this.molecular.screen(actor(r),key,b);}
 @Get('screens/:id')detail(@Req()r:ApiRequest,@Param('id')id:string){return this.molecular.screenDetail(actor(r),uuid(id));}
 @Post('screens/:id/reflect') @SchemaBody(z.object({}).strict())reflect(@Req()r:ApiRequest,@Param('id')id:string,@Headers('idempotency-key')key:string|undefined){return this.molecular.reflect(actor(r),uuid(id),key);}
 @Post('screens/:id/cancel')cancel(@Req()r:ApiRequest,@Param('id')id:string){return this.molecular.cancelScreen(actor(r),uuid(id));}
 @Delete('screens/:id')deleteScreen(@Req()r:ApiRequest,@Param('id')id:string){return this.molecular.removeScreen(actor(r),uuid(id));}
}
