import { ParamValue } from "next/dist/server/request/params";

export function transferUrl(path:string, locale:ParamValue){
    if(path.startsWith('/')){
        return `/${locale}${path}`;
    }
    return `/${locale}/${path}`;
}